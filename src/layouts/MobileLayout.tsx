import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Menu, X, LogOut } from 'lucide-react'
import { navItems, mobileTabItems } from '@/components/nav/nav-items'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeToggle } from '@/components/ThemeToggle'

export function MobileLayout() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.includes(profile?.role ?? ''))

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-ink-950">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-ink-800 bg-ink-900/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/icons/icon-192.png" alt="ILYA" className="h-8 w-8 shrink-0 rounded-lg" />
            <span className="truncate font-display text-sm font-semibold text-ink-50">ILYA</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle compact />
            <NotificationBell />
            <button type="button" onClick={() => setOpen(true)} aria-label="فتح القائمة" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-300 active:bg-ink-800">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-[100dvh] overflow-x-hidden px-3 pb-[calc(76px+env(safe-area-inset-bottom))] pt-[calc(70px+env(safe-area-inset-top))]">
        <Outlet />
      </main>

      <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink-800 bg-ink-900/97 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {mobileTabItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex min-w-0 min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-medium transition-colors',
              isActive ? 'text-brass-400' : 'text-ink-500',
            )}
          >
            <item.icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.8} />
            <span className="max-w-full truncate leading-4">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {open && (
        <div className="fixed inset-0 z-[60] flex">
          <button type="button" aria-label="إغلاق القائمة" className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
          <div className="flex w-[min(360px,88vw)] flex-col border-r border-ink-800 bg-ink-900 p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-display text-sm font-semibold text-ink-50">القائمة الكاملة</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-3"><OrganizationSwitcher /></div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                    isActive ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100',
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl bg-ink-850 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass-500/20 text-xs font-semibold text-brass-300">{profile?.full_name?.[0] ?? '؟'}</div>
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink-100">{profile?.full_name ?? '—'}</p>
              <button type="button" onClick={() => void signOut()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-500" aria-label="تسجيل الخروج"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
