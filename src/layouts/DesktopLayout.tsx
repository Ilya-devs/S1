import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { navItems } from '@/components/nav/nav-items'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeToggle } from '@/components/ThemeToggle'

export function DesktopLayout() {
  const { profile, signOut } = useAuth()
  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.includes(profile?.role ?? ''))

  return (
    <div className="min-h-[100dvh] bg-ink-950">
      <aside className="fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-ink-800 bg-ink-900/95 px-3 py-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-3 px-2">
          <img src="/icons/icon-192.png" alt="ILYA" className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold tracking-wide text-ink-50">ILYA</p>
            <p className="truncate text-[11px] text-ink-500">نظام محاسبي متكامل</p>
          </div>
        </div>

        <div className="mb-4"><OrganizationSwitcher /></div>

        <nav aria-label="التنقل الرئيسي" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn(
                'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-brass-500/15 text-brass-300 shadow-[inset_0_0_0_1px_rgba(201,162,39,0.25)]'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100',
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 space-y-2 border-t border-ink-800 pt-3">
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle compact />
            <NotificationBell />
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-ink-850 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass-500/20 text-xs font-semibold text-brass-300">
              {profile?.full_name?.[0] ?? '؟'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink-100">{profile?.full_name ?? '—'}</p>
              <p className="truncate text-[11px] text-ink-500">{roleLabel(profile?.role)}</p>
            </div>
            <button type="button" onClick={() => void signOut()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-800 hover:text-crimson-400" title="تسجيل الخروج" aria-label="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-[100dvh] overflow-x-hidden mr-64">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-5 lg:px-8">
          <div className="mb-4 flex justify-start"><NotificationBell /></div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function roleLabel(role?: string) {
  const map: Record<string, string> = { owner: 'المالك', admin: 'مدير', accountant: 'محاسب', cashier: 'كاشير', viewer: 'مشاهدة فقط' }
  return role ? (map[role] ?? role) : ''
}
