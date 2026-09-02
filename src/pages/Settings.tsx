import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'

export default function Settings() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  const { data: settings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
      return data
    },
  })

  const { data: users } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('full_name')
      return data ?? []
    },
  })

  const { data: devices } = useQuery({
    queryKey: ['devices', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('devices').select('*').eq('user_id', profile?.id ?? '')
      return data ?? []
    },
    enabled: !!profile?.id,
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
      const { error } = await supabase
        .from('app_settings')
        .update({
          company_name: form.company_name,
          company_phone: form.company_phone,
          backup_email: form.backup_email,
        })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['app_settings'] }),
  })

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="معلومات الشركة، المستخدمين، والأجهزة المرتبطة" />

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
              {(users ?? []).map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl bg-ink-850 px-3 py-2.5">
                  <div>
                    <p className="text-sm text-ink-100">{u.full_name}</p>
                    <p className="text-[11px] text-ink-500">{u.phone ?? '—'}</p>
                  </div>
                  <Badge tone="brass">{roleLabel(u.role)}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-ink-300">الأجهزة المرتبطة بحسابك</p>
            <div className="space-y-2">
              {(devices ?? []).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-ink-850 px-3 py-2.5 text-sm">
                  <span className="text-ink-200">{d.device_name}</span>
                  <Badge tone={d.is_trusted ? 'success' : 'neutral'}>{d.is_trusted ? 'موثوق' : 'غير موثوق'}</Badge>
                </div>
              ))}
              {(devices ?? []).length === 0 && <p className="text-xs text-ink-500">لا توجد أجهزة مسجلة بعد</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function roleLabel(role: string) {
  const map: Record<string, string> = { owner: 'المالك', admin: 'مدير', accountant: 'محاسب', cashier: 'كاشير', viewer: 'مشاهدة فقط' }
  return map[role] ?? role
}
