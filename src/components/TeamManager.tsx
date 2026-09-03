import { useState } from 'react'
import { Copy, MailPlus, ShieldCheck, UserX } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/lib/types'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { asArray } from '@/lib/collections'

const roles: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'مدير' },
  { value: 'accountant', label: 'محاسب' },
  { value: 'cashier', label: 'كاشير' },
  { value: 'viewer', label: 'مشاهدة فقط' },
]

async function createSecureToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return { token, hash }
}

export function TeamManager() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const orgId = profile?.active_organization_id
  const canManage = profile?.role === 'owner' || profile?.role === 'admin'
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('cashier')
  const [inviteLink, setInviteLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['organization_members', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('organization_members')
        .select('organization_id,user_id,role,is_active,joined_at,updated_at,profiles:user_id(id,full_name,phone,is_active)')
        .eq('organization_id', orgId!)
        .order('joined_at')
      if (e) throw e
      return data ?? []
    },
  })

  const memberRows = asArray(members)
  const activeMembers = memberRows.filter((m) => m.is_active)

  async function invite() {
    if (!canManage || !orgId) return
    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError('أدخل بريداً إلكترونياً صحيحاً.')
      return
    }
    setBusy(true); setError(null); setInviteLink('')
    try {
      const { token, hash } = await createSecureToken()
      const { error: e } = await supabase.from('organization_invitations').insert({
        organization_id: orgId,
        email: normalized,
        role,
        token_hash: hash,
        invited_by: profile?.id,
      })
      if (e) throw e
      const link = `${window.location.origin}/register?invite=${token}`
      setInviteLink(link)
      setEmail('')
      void qc.invalidateQueries({ queryKey: ['organization_invitations'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء الدعوة')
    } finally {
      setBusy(false)
    }
  }

  async function updateMember(userId: string, patch: { role?: UserRole; is_active?: boolean }) {
    if (!canManage || !orgId || userId === profile?.id && patch.is_active === false) return
    setError(null)
    const { error: e } = await supabase
      .from('organization_members')
      .update(patch)
      .eq('organization_id', orgId)
      .eq('user_id', userId)
    if (e) setError(e.message)
    else {
      void qc.invalidateQueries({ queryKey: ['organization_members', orgId] })
      if (userId === profile?.id && patch.role) window.location.reload()
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-ink-100">فريق المتجر</p>
          <p className="mt-1 text-xs text-ink-500">دعوة الموظفين وتحديد أدوارهم وعزل كل متجر عن الآخر.</p>
        </div>
        <Badge tone="brass">{activeMembers.length} أعضاء</Badge>
      </div>

      {canManage && (
        <div className="mb-5 grid gap-2 rounded-2xl border border-ink-800 bg-ink-850 p-3 sm:grid-cols-[1fr_150px_auto]">
          <div><Label>بريد الموظف</Label><Input dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@example.com" /></div>
          <div><Label>الدور</Label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-100">
              {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <Button className="self-end" onClick={() => void invite()} disabled={busy}><MailPlus className="h-4 w-4" /> دعوة</Button>
        </div>
      )}

      {inviteLink && (
        <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs text-emerald-300">تم إنشاء دعوة. أرسل الرابط للموظف عبر قناة موثوقة؛ الرابط صالح 7 أيام.</p>
          <div className="mt-2 flex gap-2">
            <Input dir="ltr" readOnly value={inviteLink} />
            <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(inviteLink)} title="نسخ"><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mb-3 text-xs text-crimson-400">{error}</p>}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-ink-500">جارٍ تحميل الفريق...</p>}
        {memberRows.map((m) => {
          const person = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
          return (
            <div key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-850 px-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brass-500/15 text-sm text-brass-300">{person?.full_name?.slice(0, 1) ?? '؟'}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm text-ink-100">{person?.full_name ?? m.user_id}</p><p className="text-[11px] text-ink-500">{m.is_active ? 'نشط' : 'موقوف'}</p></div>
              <select
                disabled={!canManage || m.role === 'owner'}
                value={m.role}
                onChange={(e) => void updateMember(m.user_id, { role: e.target.value as UserRole })}
                className="h-9 rounded-lg border border-ink-700 bg-ink-900 px-2 text-xs text-ink-200"
              >
                <option value="owner">المالك</option>
                {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {m.role !== 'owner' && canManage && (
                <Button variant="ghost" title={m.is_active ? 'إيقاف الموظف' : 'تفعيل الموظف'} onClick={() => void updateMember(m.user_id, { is_active: !m.is_active })}>
                  {m.is_active ? <UserX className="h-4 w-4 text-crimson-400" /> : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
