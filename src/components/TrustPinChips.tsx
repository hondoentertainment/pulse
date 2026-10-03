import { cn } from '@/lib/utils'
import type { TrustChip } from '@/lib/trust-glance'

const TONE: Record<TrustChip['tone'], string> = {
  hot: 'bg-primary/15 text-primary',
  ok: 'bg-muted text-foreground',
  soft: 'border border-border bg-transparent text-muted-foreground',
}

interface TrustPinChipsProps {
  chips: TrustChip[]
  className?: string
}

export function TrustPinChips({ chips, className }: TrustPinChipsProps) {
  if (chips.length === 0) return null
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Trust at a glance">
      {chips.map((chip) => (
        <li
          key={chip.id}
          className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TONE[chip.tone])}
        >
          {chip.label}
        </li>
      ))}
    </ul>
  )
}
