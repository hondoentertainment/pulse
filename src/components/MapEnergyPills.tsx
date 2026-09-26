import { FilterPill } from '@/components/ux/FilterPill'
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
      <FilterPill
        pressed={energyLevels.includes('electric')}
        tone="electric"
        onClick={() => onToggleEnergy('electric')}
      >
        Electric
      </FilterPill>
      <FilterPill
        pressed={energyLevels.includes('buzzing')}
        tone="buzzing"
        onClick={() => onToggleEnergy('buzzing')}
      >
        Buzzing
      </FilterPill>
      <FilterPill
        pressed={nearMeActive}
        tone="chill"
        onClick={onToggleNearMe}
      >
        Near me
      </FilterPill>
    </div>
  )
}
