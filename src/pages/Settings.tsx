import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher'
import { TeamManager } from '@/components/TeamManager'
import { ActivityLog } from '@/components/ActivityLog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { asArray } from '@/lib/collections'

export default function Settings() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const orgId = profile?.active_organization_id
  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  const { data: settings } = useQuery({
    queryKey: ['app_settings', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).eq('organization_id', orgId ?? '').single()
      return data
    },
  })

  const { data: users } = useQuery({
    queryKey: ['organization-profiles', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('organization_members').select('user_id,role,is_active,profiles:user_id(id,full_name,phone,is_active)').eq('organization_id', orgId ?? '').order('joined_at')
      return asArray(data)
    },
  })

  const { data: devices } = useQuery({
    queryKey: ['devices', profile?.id, orgId],
    queryFn: async () => {
      const { data } = await supabase.from('devices').select('*').eq('user_id', profile?.id ?? '')
      return asArray(data)
    },
    enabled: !!orgId,
  })

  const [form, setForm] = useState({ company_name: '', company_phone: '', backup_email: '' })
  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name ?? '',
        company_phone: settings.company_phone ?? '',
        backup_email: settings.backup_email ?? '',
      })
    }
  }, [settings])

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('لا يوجد متجر نشط')
      const { error } = await supabase
        .from('app_settings')
        .update({
          company_name: form.company_name,
          company_phone: form.company_phone,
          backup_email: form.backup_email,
        })
        .eq('id', 1)
        .eq('organization_id', orgId)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['app_settings', orgId] }),
  })

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="معلومات الشركة، المستخدمين، والأجهزة المرتبطة" />

      <div className="mb-6 max-w-xl">
        <OrganizationSwitcher />
      </div>


      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-100">مظهر التطبيق</p>
            <p className="mt-1 text-xs leading-5 text-ink-500">اختر النهاري أو الليلي أو دع ILYA يتبع ثيم جهازك تلقائياً مع تغيّر النظام.</p>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-4 text-sm font-medium text-ink-300">معلومات الشركة</p>
          <div className="space-y-3">
            <div>
              <Label>اسم الشركة / المتجر</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <Input
                dir="ltr"
                value={form.company_phone}
                onChange={(e) => setForm({ ...form, company_phone: e.target.value })}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <Label>البريد الإلكتروني لاستلام النسخ الاحتياطية</Label>
              <Input
                dir="ltr"
                type="email"
                value={form.backup_email}
                onChange={(e) => setForm({ ...form, backup_email: e.target.value })}
                disabled={!isAdmin}
              />
            </div>
            {saveSettings.isError && (
              <p role="alert" className="text-xs text-crimson-400">
                {saveSettings.error instanceof Error ? saveSettings.error.message : 'تعذر حفظ الإعدادات'}
              </p>
            )}
            {isAdmin && (
              <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                {saveSettings.isPending ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-ink-300">المستخدمون</p>
            <div className="space-y-2">
              {asArray(users).map((u) => {
                const person = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles
                return (
                  <div key={u.user_id} className="flex items-center justify-between rounded-xl bg-ink-850 px-3 py-2.5">
                    <div>
                      <p className="text-sm text-ink-100">{person?.full_name ?? '—'}</p>
                      <p className="text-[11px] text-ink-500">{person?.phone ?? '—'}</p>
                    </div>
                    <Badge tone="brass">{roleLabel(u.role)}</Badge>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-ink-300">الأجهزة المرتبطة بحسابك</p>
            <div className="space-y-2">
              {asArray(devices).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-ink-850 px-3 py-2.5 text-sm">
                  <span className="text-ink-200">{d.device_name}</span>
                  <Badge tone={d.is_trusted ? 'success' : 'neutral'}>{d.is_trusted ? 'موثوق' : 'غير موثوق'}</Badge>
                </div>
              ))}
              {asArray(devices).length === 0 && <p className="text-xs text-ink-500">لا توجد أجهزة مسجلة بعد</p>}
            </div>
          </Card>
        </div>
      </div>

      {isAdmin && (
        <>
          <div className="mt-6"><TeamManager /></div>
          <ActivityLog />
        </>
      )}
    </div>
  )
}

function roleLabel(role: string) {
  const map: Record<string, string> = { owner: 'المالك', admin: 'مدير', accountant: 'محاسب', cashier: 'كاشير', viewer: 'مشاهدة فقط' }
  return map[role] ?? role
}
