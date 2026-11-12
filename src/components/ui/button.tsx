import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-[#256a60] text-white hover:bg-[#1c5d53]',
        ghost: 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
        outline: 'border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50',
        secondary: 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200',
      },
      size: { default: 'h-7 px-2.5', sm: 'h-6 px-2', icon: 'h-7 w-7 p-0', lg: 'h-8 px-4' },
    },
    defaultVariants: { variant: 'ghost', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'
