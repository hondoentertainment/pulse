import { FilterPill } from '@/components/ux/FilterPill'
import type { MapInventoryLayer } from '@/lib/map-filters'

interface MapInventoryPillsProps {
  inventoryLayer: MapInventoryLayer
  nearMeActive: boolean
  onInventoryLayerChange: (layer: MapInventoryLayer) => void
  onToggleNearMe: () => void
  seattle?: boolean
  curatedLabel?: string
  allLabel?: string
}

export function MapInventoryPills({
  inventoryLayer,
  nearMeActive,
  onInventoryLayerChange,
  onToggleNearMe,
  seattle = true,
  curatedLabel,
  allLabel,
}: MapInventoryPillsProps) {
  const curatedText = curatedLabel ?? (seattle ? 'Launch 33' : 'Curated')
  const allText = allLabel ?? (seattle ? 'All Seattle' : 'All venues')
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Map inventory">
      <FilterPill
        pressed={inventoryLayer === 'curated'}
        onClick={() => onInventoryLayerChange('curated')}
      >
        {curatedText}
      </FilterPill>
      <FilterPill
        pressed={inventoryLayer === 'all'}
        onClick={() => onInventoryLayerChange('all')}
      >
        {allText}
      </FilterPill>
      <FilterPill
        pressed={nearMeActive}
        onClick={onToggleNearMe}
      >
        Surging
      </FilterPill>
    </div>
  )
}
