import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 animate-fade-up sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words font-display text-xl font-semibold text-ink-50 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'brass' | 'success' | 'danger'
  icon?: ReactNode
}) {
  const toneRing: Record<string, string> = {
    neutral: 'text-ink-100',
    brass: 'text-brass-400',
    success: 'text-emerald-400',
    danger: 'text-crimson-400',
  }
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 shadow-[var(--shadow-panel)] animate-fade-up">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        {icon && <div className="text-ink-600">{icon}</div>}
      </div>
      <p className={`mt-2 tabular-nums-ltr text-right text-2xl font-semibold ${toneRing[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-ink-600">{hint}</p>}
    </div>
  )
}
