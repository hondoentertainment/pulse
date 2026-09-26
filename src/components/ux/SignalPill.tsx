import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { signalToneClass, type SignalTone } from '@/lib/signal-tone'

interface SignalPillProps {
  tone: SignalTone
  children: ReactNode
  className?: string
}

/** Static energy / status chip. Same tint as FilterPill, not a toggle. */
export function SignalPill({ tone, children, className }: SignalPillProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-3 py-[7px] text-[12px] font-medium leading-none',
        signalToneClass(tone),
        className,
      )}
    >
      {children}
    </span>
  )
}
