import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { FilterPill } from '@/components/ux/FilterPill'
import { energyAccessibleName, nextRovingIndex } from '@/lib/surface-a11y'

const LEVELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

interface EnergyPillsProps {
  value: EnergyRating
  onChange: (value: EnergyRating) => void
}

export function EnergyPills({ value, onChange }: EnergyPillsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Energy"
      data-surface="composer"
      className="flex flex-wrap gap-2"
      onKeyDown={(event) => {
        const current = LEVELS.indexOf(value)
        const next = nextRovingIndex(current, LEVELS.length, event.key)
        if (next === null) return
        event.preventDefault()
        onChange(LEVELS[next])
      }}
    >
      {LEVELS.map((level) => {
        const config = ENERGY_CONFIG[level]
        const selected = value === level
        return (
          <FilterPill
            key={level}
            pressed={selected}
            tone={level}
            role="radio"
            aria-checked={selected}
            aria-label={energyAccessibleName(level)}
            onClick={() => onChange(level)}
          >
            {config.label}
          </FilterPill>
        )
      })}
    </div>
  )
}
