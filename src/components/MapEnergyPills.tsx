import { cn } from '@/lib/utils'
import type { EnergyFilter } from '@/components/MapFilters'

interface MapEnergyPillsProps {
  energyLevels: EnergyFilter[]
  nearMeActive: boolean
  onToggleEnergy: (level: Extract<EnergyFilter, 'electric' | 'buzzing'>) => void
  onToggleNearMe: () => void
}

export function MapEnergyPills({
  energyLevels,
  nearMeActive,
  onToggleEnergy,
  onToggleNearMe,
}: MapEnergyPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Map filters">
      <button
        type="button"
        onClick={() => onToggleEnergy('electric')}
        aria-pressed={energyLevels.includes('electric')}
        className={cn(
          'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold touch-manipulation',
          energyLevels.includes('electric')
            ? 'bg-primary text-primary-foreground'
            : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD]',
        )}
      >
        Electric
      </button>
      <button
        type="button"
        onClick={() => onToggleEnergy('buzzing')}
        aria-pressed={energyLevels.includes('buzzing')}
        className={cn(
          'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold touch-manipulation',
          energyLevels.includes('buzzing')
            ? 'bg-[var(--energy-buzzing)] text-white'
            : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD]',
        )}
      >
        Buzzing
      </button>
      <button
        type="button"
        onClick={onToggleNearMe}
        aria-pressed={nearMeActive}
        className={cn(
          'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold touch-manipulation',
          nearMeActive
            ? 'bg-accent text-accent-foreground'
            : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD]',
        )}
      >
        Near me
      </button>
    </div>
  )
}
