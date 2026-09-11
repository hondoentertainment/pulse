import { FilterPill } from '@/components/ux/FilterPill'
import type { MapInventoryLayer } from '@/lib/map-filters'

interface MapInventoryPillsProps {
  inventoryLayer: MapInventoryLayer
  nearMeActive: boolean
  onInventoryLayerChange: (layer: MapInventoryLayer) => void
  onToggleNearMe: () => void
}

export function MapInventoryPills({
  inventoryLayer,
  nearMeActive,
  onInventoryLayerChange,
  onToggleNearMe,
}: MapInventoryPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Map inventory">
      <FilterPill
        pressed={inventoryLayer === 'curated'}
        onClick={() => onInventoryLayerChange('curated')}
      >
        Launch 33
      </FilterPill>
      <FilterPill
        pressed={inventoryLayer === 'all'}
        onClick={() => onInventoryLayerChange('all')}
      >
        All Seattle
      </FilterPill>
      <FilterPill
        pressed={nearMeActive}
        onClick={onToggleNearMe}
      >
        Near me
      </FilterPill>
    </div>
  )
}
