import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { FilterPill } from '@/components/ux/FilterPill'

const LEVELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

interface EnergyPillsProps {
  value: EnergyRating
  onChange: (value: EnergyRating) => void
}

export function EnergyPills({ value, onChange }: EnergyPillsProps) {
  return (
    <div role="group" aria-label="Energy" className="flex flex-wrap gap-2">
      {LEVELS.map((level) => {
        const config = ENERGY_CONFIG[level]
        const selected = value === level
        return (
          <FilterPill
            key={level}
            pressed={selected}
            activeColor={config.color}
            onClick={() => onChange(level)}
          >
            {config.label}
          </FilterPill>
        )
      })}
    </div>
  )
}
