import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, DatabaseBackup, Download, FileUp, KeyRound, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/format'
import { asArray } from '@/lib/collections'

const TABLES = [
  'app_settings',
  'product_categories',
  'customers',
  'suppliers',
  'products',
  'sales_invoices',
  'sales_invoice_items',
  'purchase_invoices',
  'purchase_invoice_items',
  'sales_returns',
  'sales_return_items',
  'purchase_returns',
  'purchase_return_items',
  'debt_payments',
  'expense_categories',
  'expenses',
  'audit_log',
] as const

type BackupPayload = {
  format: 'ILYA_BACKUP'
  version: 1
  backup_id: string
  restore_code_hash: string
  organization_id: string
  created_at: string
  app: 'ILYA'
  tables: Record<string, unknown[]>
  sha256?: string
}

function makeBackupId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const bytes = crypto.getRandomValues(new Uint8Array(3))
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `ILYABK-${stamp}-${suffix}`
}

function makeRestoreCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function validateBackup(value: unknown): BackupPayload {
  if (!value || typeof value !== 'object') throw new Error('ملف النسخة غير صالح.')
  const v = value as Partial<BackupPayload>
  if (v.format !== 'ILYA_BACKUP' || v.version !== 1 || typeof v.backup_id !== 'string' || typeof v.restore_code_hash !== 'string') {
    throw new Error('هذا الملف ليس نسخة ILYA صالحة أو إصدار النسخة غير مدعوم.')
  }
  if (typeof v.organization_id !== 'string' || !v.organization_id) throw new Error('معرّف المتجر مفقود من النسخة.')
  if (!v.tables || typeof v.tables !== 'object') throw new Error('بيانات النسخة مفقودة.')
  const tables: Record<string, unknown[]> = {}
  for (const table of TABLES) {
    const value = (v.tables as Record<string, unknown>)[table]
    if (value !== undefined && !Array.isArray(value)) throw new Error(`بيانات جدول ${table} غير صالحة.`)
    tables[table] = Array.isArray(value) ? value : []
  }
  return { ...(v as BackupPayload), tables }
}

export default function Backup() {
  const { profile } = useAuth()
  const orgId = profile?.active_organization_id
  const inputRef = useRef<HTMLInputElement>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoreFile, setRestoreFile] = useState<BackupPayload | null>(null)
  const [restoreCode, setRestoreCode] = useState('')

  const { data: log, refetch } = useQuery({
    queryKey: ['backup_log', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error: e } = await supabase.from('backup_log').select('*').order('created_at', { ascending: false }).limit(10)
      if (e) throw e
      return asArray(data)
    },
  })

  const totalRecords = useMemo(() => restoreFile ? Object.values(restoreFile.tables).reduce((n, rows) => n + rows.length, 0) : 0, [restoreFile])

  async function handleExport() {
    if (!orgId) return
    setWorking(true); setError(null); setMessage(null)
    try {
      const tables: Record<string, unknown[]> = {}
      const pageSize = 500
      const maxRecordsPerTable = 100_000
      for (const table of TABLES) {
        const rows: unknown[] = []
        for (let offset = 0; offset < maxRecordsPerTable; offset += pageSize) {
          const { data, error: tableError } = await supabase
            .from(table)
            .select('*')
            .range(offset, offset + pageSize - 1)
          if (tableError) throw new Error(`تعذر قراءة ${table}: ${tableError.message}`)
          const page = asArray(data)
          rows.push(...page)
          if (page.length < pageSize) break
          if (rows.length >= maxRecordsPerTable) throw new Error(`جدول ${table} تجاوز حد النسخ الآمن (${maxRecordsPerTable} سجل).`)
        }
        tables[table] = rows
      }

      const restoreCode = makeRestoreCode()
      const backup: BackupPayload = {
        format: 'ILYA_BACKUP',
        version: 1,
        backup_id: makeBackupId(),
        restore_code_hash: await sha256(restoreCode),
        organization_id: orgId,
        created_at: new Date().toISOString(),
        app: 'ILYA',
        tables,
      }
      const canonical = JSON.stringify(backup)
      backup.sha256 = await sha256(canonical)
      const fileText = JSON.stringify(backup, null, 2)
      const blob = new Blob([fileText], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ilya-backup-${backup.backup_id}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      const { error: logError } = await supabase.rpc('log_backup', { p_status: 'success', p_file_size_bytes: blob.size })
      if (logError) throw logError
      setMessage(`تم تنزيل النسخة. رمز الاستعادة: ${restoreCode} — احتفظ به مع الملف.`)
      void refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء النسخة الاحتياطية.')
      try { await supabase.rpc('log_backup', { p_status: 'failed', p_file_size_bytes: 0 }) } catch { /* keep original error */ }
    } finally {
      setWorking(false)
    }
  }

  async function readRestoreFile(file: File) {
    setError(null); setMessage(null)
    if (file.size > 25 * 1024 * 1024) throw new Error('حجم النسخة أكبر من الحد المسموح (25MB).')
    const text = await file.text()
    let raw: unknown
    try { raw = JSON.parse(text) } catch { throw new Error('ملف النسخة ليس JSON صالحاً.') }
    const parsed = validateBackup(raw)
    if (parsed.sha256) {
      const { sha256: _storedHash, ...withoutHash } = parsed
      const actualHash = await sha256(JSON.stringify(withoutHash))
      if (actualHash !== parsed.sha256) throw new Error('فشل التحقق من سلامة الملف: محتوى النسخة تغيّر أو تلف.')
    }
    if (parsed.organization_id !== orgId) throw new Error('هذه النسخة تخص متجراً آخر. للاستعادة يجب استخدام النسخة مع المتجر الذي أُنشئت منه.')
    setRestoreFile(parsed)
    setRestoreCode('')
  }

  async function restore() {
    if (!restoreFile) {
      setError('اختر ملف النسخة أولاً.')
      return
    }
    const enteredCodeHash = await sha256(restoreCode.trim().toUpperCase())
    if (enteredCodeHash !== restoreFile.restore_code_hash) {
      setError('رمز الاستعادة غير صحيح.')
      return
    }
    if (!orgId || profile?.role !== 'owner') {
      setError('استعادة النسخة متاحة لمالك المتجر فقط.')
      return
    }

    setWorking(true); setError(null); setMessage(null)
    try {
      // Merge/upsert restore: existing rows are updated, missing rows are added.
      // We deliberately do not delete rows that are absent from a backup.
      const batchSize = 100
      for (const table of TABLES) {
        const rows = restoreFile.tables[table]
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize).map((row) => {
            if (!row || typeof row !== 'object') throw new Error(`بيانات ${table} تحتوي سجلاً غير صالح.`)
            return { ...(row as Record<string, unknown>), organization_id: orgId }
          })
          if (!batch.length) continue
          const { error: restoreError } = await supabase.from(table).upsert(batch, { onConflict: 'id' })
          if (restoreError) throw new Error(`تعذر استعادة ${table}: ${restoreError.message}`)
        }
      }
      setMessage(`تمت استعادة ${totalRecords} سجلاً بنمط الدمج الآمن. لم يتم حذف أي بيانات غير موجودة في النسخة.`)
      setRestoreFile(null)
      setRestoreCode('')
      void refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذرت استعادة النسخة. لم يتم تجاهل الخطأ.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="النسخ الاحتياطي" subtitle="نسخة محلية قابلة للتنزيل والاستعادة مع معرّف ورمز تحقق خاصين بمتجرك." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brass-500/10 text-brass-400"><DatabaseBackup className="h-6 w-6" /></div>
            <div className="min-w-0">
              <p className="font-medium text-ink-100">إنشاء نسخة احتياطية</p>
              <p className="mt-1 text-xs leading-5 text-ink-500">النسخة تخص المتجر الحالي فقط ولا تتضمن كلمات المرور أو مفاتيح Supabase.</p>
            </div>
          </div>
          <Button className="w-full" onClick={() => void handleExport()} disabled={working || !orgId}>
            <Download className="h-4 w-4 shrink-0" /> {working ? 'جارٍ إنشاء النسخة...' : 'تنزيل ملف النسخة'}
          </Button>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400"><FileUp className="h-6 w-6" /></div>
            <div className="min-w-0">
              <p className="font-medium text-ink-100">استعادة نسخة</p>
              <p className="mt-1 text-xs leading-5 text-ink-500">استعادة آمنة بنمط الدمج؛ لا يتم حذف البيانات الحالية تلقائياً.</p>
            </div>
          </div>
          <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0]
            e.currentTarget.value = ''
            if (file) void readRestoreFile(file).catch((e) => setError(e instanceof Error ? e.message : 'الملف غير صالح.'))
          }} />
          <Button variant="secondary" className="w-full" onClick={() => inputRef.current?.click()} disabled={working}>
            <FileUp className="h-4 w-4 shrink-0" /> اختيار ملف النسخة
          </Button>

          {restoreFile && (
            <div className="mt-4 space-y-3 rounded-2xl border border-ink-800 bg-ink-850 p-4">
              <div className="flex items-center gap-2 text-sm text-ink-200"><ShieldCheck className="h-4 w-4 text-emerald-400" /> نسخة صالحة</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-ink-500">المعرّف</span><p dir="ltr" className="mt-1 break-all text-ink-200">{restoreFile.backup_id}</p></div>
                <div><span className="text-ink-500">السجلات</span><p className="mt-1 text-ink-200">{totalRecords}</p></div>
              </div>
              <div>
                <Label htmlFor="restore-code">رمز الاستعادة</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                  <Input id="restore-code" dir="ltr" inputMode="text" autoComplete="off" className="pr-9 tracking-widest" value={restoreCode} onChange={(e) => setRestoreCode(e.target.value.toUpperCase())} placeholder="XXXXXXXXXX" />
                </div>
              </div>
              <Button className="w-full" onClick={() => void restore()} disabled={working || profile?.role !== 'owner'}>
                {working ? 'جارٍ الاستعادة...' : 'استعادة ودمج البيانات'}
              </Button>
              <p className="text-[11px] leading-5 text-ink-600">لأمان البيانات، لا يتم تنفيذ الاستعادة إلا للمالك وبعد مطابقة المتجر ورمز النسخة.</p>
            </div>
          )}
        </Card>
      </div>

      {message && <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}
      {error && <div role="alert" className="rounded-2xl border border-crimson-500/20 bg-crimson-500/5 p-4 text-sm leading-6 text-crimson-300">{error}</div>}

      <Card className="overflow-hidden">
        <div className="border-b border-ink-800 px-4 py-3"><p className="text-sm font-medium text-ink-300">سجل النسخ الاحتياطية</p></div>
        <div className="divide-y divide-ink-850">
          {asArray(log).map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="text-ink-300">{formatDateTime(l.created_at)}</span>
              <span className="text-ink-500">{l.file_size_bytes ? `${Math.round(l.file_size_bytes / 1024)} كيلوبايت` : '—'}</span>
              <Badge tone={l.status === 'success' ? 'success' : 'danger'}>{l.status === 'success' ? 'ناجحة' : 'فشلت'}</Badge>
            </div>
          ))}
          {asArray(log).length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-500">لا يوجد سجل بعد</p>}
        </div>
      </Card>
    </div>
  )
}
