import { cn } from '@/lib/utils'
import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { getEnergyLabel } from '@/lib/pulse-engine'

const LABEL_TO_RATING: Record<string, EnergyRating> = {
  Dead: 'dead',
  Chill: 'chill',
  Buzzing: 'buzzing',
  Electric: 'electric',
}

interface EnergyBadgeProps {
  score?: number
  rating?: EnergyRating
  label?: string
  filled?: boolean
  className?: string
}

export function EnergyBadge({ score, rating, label, filled = true, className }: EnergyBadgeProps) {
  const resolvedLabel = label ?? (rating ? ENERGY_CONFIG[rating].label : getEnergyLabel(score ?? 0))
  const resolvedRating = rating ?? LABEL_TO_RATING[resolvedLabel] ?? 'chill'
  const color = ENERGY_CONFIG[resolvedRating].color

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        className,
      )}
      style={
        filled
          ? { backgroundColor: color, color: '#fff' }
          : { color, border: `1px solid ${color}` }
      }
    >
      {resolvedLabel}
    </span>
  )
}
