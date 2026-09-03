import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/context/ThemeContext'
import { cn } from '@/lib/cn'

const modes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'حسب نظام الجهاز', icon: Monitor },
  { value: 'light', label: 'الوضع النهاري', icon: Sun },
  { value: 'dark', label: 'الوضع الليلي', icon: Moon },
]

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme()
  const current = modes.find((item) => item.value === mode) ?? modes[0]
  const Icon = current.icon

  return (
    <div className={cn('flex items-center rounded-xl border border-ink-800 bg-ink-900/80 p-1', compact ? 'gap-0' : 'gap-1')}>
      {modes.map(({ value, label, icon: ModeIcon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => setMode(value)}
          className={cn(
            'flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs transition-colors',
            mode === value ? 'bg-brass-500/15 text-brass-400' : 'text-ink-500 hover:bg-ink-800 hover:text-ink-200',
          )}
        >
          <ModeIcon className="h-4 w-4 shrink-0" />
          {!compact && <span className="hidden sm:inline">{value === 'system' ? 'النظام' : value === 'light' ? 'نهاري' : 'ليلي'}</span>}
        </button>
      ))}
      {compact && <Icon className="sr-only" aria-hidden="true" />}
    </div>
  )
}
