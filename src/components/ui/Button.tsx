import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] min-w-0 text-center leading-5',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-b from-brass-400 to-brass-600 text-ink-950 shadow-[var(--shadow-glow-brass)] hover:brightness-110',
        secondary: 'bg-ink-800 text-ink-100 border border-ink-700 hover:bg-ink-700',
        ghost: 'text-ink-300 hover:text-ink-50 hover:bg-ink-800',
        danger: 'bg-crimson-500/15 text-crimson-400 border border-crimson-500/30 hover:bg-crimson-500/25',
        success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'
