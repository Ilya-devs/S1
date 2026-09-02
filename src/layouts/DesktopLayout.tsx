import { NavLink, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { navItems } from '@/components/nav/nav-items'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'

export function DesktopLayout() {
  const { profile, signOut } = useAuth()
  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.includes(profile?.role ?? ''))

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950">
      <aside className="flex w-64 shrink-0 flex-col border-l border-ink-800 bg-ink-900/70 px-3 py-5">
        <div className="mb-6 flex items-center gap-3 px-2">
          <img src="/icons/icon-192.png" alt="ILYA" className="h-9 w-9 rounded-lg" />
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-ink-50">ILYA</p>
            <p className="text-[11px] text-ink-500">نظام محاسبي</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-gradient-to-l from-brass-500/15 to-transparent text-brass-300 shadow-[inset_0_0_0_1px_rgba(201,162,39,0.25)]'
                    : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 space-y-2 border-t border-ink-800 pt-3">
          <div className="flex items-center gap-2 rounded-xl bg-ink-850 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brass-500/20 text-xs font-semibold text-brass-300">
              {profile?.full_name?.[0] ?? '؟'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink-100">{profile?.full_name ?? '—'}</p>
              <p className="truncate text-[11px] text-ink-500">{roleLabel(profile?.role)}</p>
            </div>
            <button
              onClick={() => void signOut()}
              className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-crimson-400"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <a
            href="https://ILYA-3.pages.dev/"
            target="_blank"
            rel="noreferrer"
            className="block px-2 text-center text-[11px] text-ink-600 hover:text-brass-400"
          >
            © {new Date().getFullYear()} ILYA dev
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function roleLabel(role?: string) {
  const map: Record<string, string> = {
    owner: 'المالك',
    admin: 'مدير',
    accountant: 'محاسب',
    cashier: 'كاشير',
    viewer: 'مشاهدة فقط',
  }
  return role ? (map[role] ?? role) : ''
}
