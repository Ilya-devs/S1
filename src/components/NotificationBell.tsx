import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { asArray } from '@/lib/collections'

export function NotificationBell() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const orgId = profile?.active_organization_id

  const { data } = useQuery({
    queryKey: ['notifications', profile?.id, orgId],
    enabled: !!profile?.id && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,title,body,is_read,created_at')
        .eq('organization_id', orgId ?? '')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 60_000,
  })

  const notifications = asArray(data)
  const unread = notifications.filter((n) => !n.is_read).length

  async function markAllRead() {
    if (!profile?.id || !orgId || unread === 0) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('organization_id', orgId).eq('is_read', false)
    void qc.invalidateQueries({ queryKey: ['notifications', profile.id, orgId] })
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="relative rounded-xl p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100" title="الإشعارات">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-crimson-500 px-1 text-[9px] text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-ink-700 bg-ink-900 p-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink-800 px-2 pb-2">
            <p className="text-sm font-medium text-ink-100">الإشعارات</p>
            <button type="button" onClick={() => void markAllRead()} className="flex items-center gap-1 text-[11px] text-brass-400 hover:text-brass-300"><CheckCheck className="h-3.5 w-3.5" /> تعليم الكل كمقروء</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className={`rounded-xl px-2 py-3 ${n.is_read ? '' : 'bg-brass-500/5'}`}>
                <div className="flex gap-2"><span className={`mt-1 h-2 w-2 rounded-full ${n.is_read ? 'bg-ink-700' : 'bg-brass-400'}`} /><div className="min-w-0 flex-1"><p className="text-xs font-medium text-ink-100">{n.title}</p><p className="mt-1 text-xs text-ink-400">{n.body}</p><p className="mt-1 text-[10px] text-ink-600">{formatDateTime(n.created_at)}</p></div></div>
              </div>
            ))}
            {notifications.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-500">لا توجد إشعارات</p>}
          </div>
        </div>
      )}
    </div>
  )
}
