import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { UX_PILL_ACTIVE, UX_PILL_IDLE } from '@/lib/ux-chrome'

interface FilterPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  children: ReactNode
  activeColor?: string
}

/** Uber floating filter chip — large tap target; selected is inverted white / black. */
export function FilterPill({
  pressed = false,
  children,
  className,
  activeColor: _activeColor,
  type = 'button',
  ...props
}: FilterPillProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'min-h-11 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold touch-manipulation',
        pressed ? UX_PILL_ACTIVE : UX_PILL_IDLE,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
