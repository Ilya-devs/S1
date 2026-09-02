import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DatabaseBackup, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/format'

const TABLES = [
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
  'expenses',
] as const

export default function Backup() {
  const { profile } = useAuth()
  const [working, setWorking] = useState(false)

  const { data: log, refetch } = useQuery({
    queryKey: ['backup_log'],
    queryFn: async () => {
      const { data } = await supabase.from('backup_log').select('*').order('created_at', { ascending: false }).limit(10)
      return data ?? []
    },
  })

  async function handleExport() {
    setWorking(true)
    try {
      const dump: Record<string, unknown> = {}
      for (const table of TABLES) {
        const { data } = await supabase.from(table).select('*')
        dump[table] = data ?? []
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ilya-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      const size = new Blob([JSON.stringify(dump)]).size
      await supabase.from('backup_log').insert({ triggered_by: profile?.id, status: 'success', file_size_bytes: size })
      void refetch()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div>
      <PageHeader title="النسخ الاحتياطي" subtitle="تصدير نسخة كاملة من بيانات النظام بصيغة JSON" />

      <Card className="mb-6 flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brass-500/10 text-brass-400">
          <DatabaseBackup className="h-8 w-8" />
        </div>
        <div>
          <p className="font-medium text-ink-100">تنزيل نسخة احتياطية الآن</p>
          <p className="mt-1 max-w-sm text-sm text-ink-500">
            يتم تنزيل ملف JSON يحتوي كل البيانات (الزبائن، الموردين، الفواتير، المخزون، الديون). احتفظ بالنسخة في بريدك
            الإلكتروني أو مكان آمن.
          </p>
        </div>
        <Button onClick={handleExport} disabled={working}>
          <Download className="h-4 w-4" /> {working ? 'جارٍ التصدير...' : 'تنزيل نسخة احتياطية'}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-ink-800 px-4 py-3">
          <p className="text-sm font-medium text-ink-300">سجل النسخ الاحتياطية</p>
        </div>
        <div className="divide-y divide-ink-850">
          {(log ?? []).map((l) => (
            <div key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-ink-300">{formatDateTime(l.created_at)}</span>
              <span className="text-ink-500">{l.file_size_bytes ? `${Math.round(l.file_size_bytes / 1024)} كيلوبايت` : '—'}</span>
              <span className={l.status === 'success' ? 'text-emerald-400' : 'text-crimson-400'}>
                {l.status === 'success' ? 'ناجحة' : 'فشلت'}
              </span>
            </div>
          ))}
          {(log ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-500">لا يوجد سجل بعد</p>}
        </div>
      </Card>
    </div>
  )
}
