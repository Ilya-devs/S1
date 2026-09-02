import { type InputHTMLAttributes, type HTMLAttributes, type LabelHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-sm shadow-[var(--shadow-panel)]',
        className
      )}
      {...props}
    />
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-ink-700 bg-ink-850 px-3.5 text-sm text-ink-50 placeholder:text-ink-500',
        'outline-none transition-colors focus:border-brass-500 focus:ring-2 focus:ring-brass-500/20',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-ink-400', className)} {...props} />
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'brass' | 'success' | 'danger' | 'warning' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-800 text-ink-300 border-ink-700',
    brass: 'bg-brass-500/15 text-brass-400 border-brass-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    danger: 'bg-crimson-500/15 text-crimson-400 border-crimson-500/30',
    warning: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className
      )}
      {...props}
    />
  )
}
