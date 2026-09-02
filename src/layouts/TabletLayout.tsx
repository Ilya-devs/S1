import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { navItems } from '@/components/nav/nav-items'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'

export function TabletLayout() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.includes(profile?.role ?? ''))

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950">
      {/* Icon rail, always visible */}
      <aside className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-l border-ink-800 bg-ink-900/70 py-5">
        <img src="/icons/icon-192.png" alt="ILYA" className="mb-4 h-9 w-9 rounded-lg" />
        {visibleNavItems.slice(0, 7).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                isActive ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
              )
            }
            title={item.label}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.75} />
          </NavLink>
        ))}
        <button
          onClick={() => setOpen(true)}
          className="mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </aside>

      {/* Slide-over full menu */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 border-l border-ink-800 bg-ink-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-ink-50">القائمة</p>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                      isActive ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-ink-850 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brass-500/20 text-xs font-semibold text-brass-300">
                {profile?.full_name?.[0] ?? '؟'}
              </div>
              <p className="flex-1 truncate text-xs font-medium text-ink-100">{profile?.full_name}</p>
              <button onClick={() => void signOut()} className="rounded-lg p-1.5 text-ink-500 hover:text-crimson-400">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
