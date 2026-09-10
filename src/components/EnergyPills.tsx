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
              'min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors touch-manipulation',
              selected
                ? 'border border-transparent text-white'
                : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD]',
            )}
            style={selected ? { backgroundColor: config.color } : undefined}
          >
            {config.label}
          </button>
        )
      })}
    </div>
  )
}
