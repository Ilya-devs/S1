import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Menu, X, LogOut } from 'lucide-react'
import { navItems, mobileTabItems } from '@/components/nav/nav-items'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'

export function MobileLayout() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-ink-950">
      <header className="flex shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="ILYA" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-sm font-semibold text-ink-50">ILYA</span>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-300 active:bg-ink-800">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <Outlet />
      </main>

      <nav className="grid shrink-0 grid-cols-4 border-t border-ink-800 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        {mobileTabItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors',
                isActive ? 'text-brass-400' : 'text-ink-500'
              )
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
          <div className="flex w-[82%] max-w-sm flex-col bg-ink-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-ink-50">القائمة الكاملة</p>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm',
                      isActive ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400'
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink-850 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brass-500/20 text-xs font-semibold text-brass-300">
                {profile?.full_name?.[0] ?? '؟'}
              </div>
              <p className="flex-1 truncate text-xs font-medium text-ink-100">{profile?.full_name}</p>
              <button onClick={() => void signOut()} className="rounded-lg p-1.5 text-ink-500">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
