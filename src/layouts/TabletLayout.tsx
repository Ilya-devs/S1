import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { navItems } from '@/components/nav/nav-items'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeToggle } from '@/components/ThemeToggle'

export function TabletLayout() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.includes(profile?.role ?? ''))

  return (
    <div className="min-h-[100dvh] bg-ink-950">
      <aside className="fixed inset-y-0 right-0 z-40 flex w-[82px] flex-col items-center border-l border-ink-800 bg-ink-900/95 py-4 shadow-xl backdrop-blur-xl">
        <img src="/icons/icon-192.png" alt="ILYA" className="mb-4 h-10 w-10 rounded-xl" />
        <nav aria-label="التنقل الرئيسي" className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} title={item.label}
              className={({ isActive }) => cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
                isActive ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100',
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="sr-only">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-3 flex flex-col items-center gap-1 border-t border-ink-800 pt-3">
          <ThemeToggle compact />
          <NotificationBell />
          <button type="button" onClick={() => setOpen(true)} aria-label="فتح القائمة" className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-[60] flex">
          <button type="button" aria-label="إغلاق القائمة" className="flex-1 cursor-default bg-black/60" onClick={() => setOpen(false)} />
          <div className="flex w-[min(360px,88vw)] flex-col border-r border-ink-800 bg-ink-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-display text-sm font-semibold text-ink-50">القائمة</p>
              <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-800" aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-4"><OrganizationSwitcher /></div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn('flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm', isActive ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100')}>
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl bg-ink-850 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass-500/20 text-xs text-brass-300">{profile?.full_name?.[0] ?? '؟'}</div>
              <p className="min-w-0 flex-1 truncate text-xs text-ink-100">{profile?.full_name ?? '—'}</p>
              <button type="button" onClick={() => void signOut()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:text-crimson-400" aria-label="تسجيل الخروج"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-[100dvh] overflow-x-hidden mr-[82px]">
        <div className="mx-auto w-full max-w-[1100px] px-5 py-5 lg:px-7">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
