import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { UX_PILL_ACTIVE, UX_PILL_IDLE } from '@/lib/ux-chrome'
import { signalToneClass, type SignalTone } from '@/lib/signal-tone'

interface FilterPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  children: ReactNode
  activeColor?: string
  /** Energy hue. The chip keeps its color when idle; pressed deepens the tint. */
  tone?: SignalTone
}

/** One-thumb filter chip. Energy tones stay tinted; other chips use cyan when pressed. */
export function FilterPill({
  pressed = false,
  children,
  className,
  activeColor: _activeColor,
  tone,
  type = 'button',
  ...props
}: FilterPillProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'min-h-11 shrink-0 rounded-full px-3 py-[7px] text-[12px] font-medium leading-none touch-manipulation',
        tone ? signalToneClass(tone, pressed) : pressed ? UX_PILL_ACTIVE : UX_PILL_IDLE,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
