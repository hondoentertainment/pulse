import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { cn } from '@/lib/utils'

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
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            aria-pressed={selected}
            className={cn(
              'min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors touch-manipulation',
              selected ? 'text-white' : 'bg-transparent',
            )}
            style={{
              borderColor: config.color,
              color: selected ? '#fff' : config.color,
              backgroundColor: selected ? config.color : 'transparent',
            }}
          >
            {config.label}
          </button>
        )
      })}
    </div>
  )
}
