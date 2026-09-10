import { cn } from '@/lib/utils'
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
      <button
        type="button"
        onClick={() => onInventoryLayerChange('curated')}
        aria-pressed={inventoryLayer === 'curated'}
        className={cn(
          'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold touch-manipulation',
          inventoryLayer === 'curated'
            ? 'bg-primary text-primary-foreground'
            : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD]',
        )}
      >
        Launch 33
      </button>
      <button
        type="button"
        onClick={() => onInventoryLayerChange('all')}
        aria-pressed={inventoryLayer === 'all'}
        className={cn(
          'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold touch-manipulation',
          inventoryLayer === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD]',
        )}
      >
        All Seattle
      </button>
      <button
        type="button"
        onClick={onToggleNearMe}
        aria-pressed={nearMeActive}
        className={cn(
          'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold touch-manipulation',
          nearMeActive
            ? 'bg-primary text-primary-foreground'
            : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD]',
        )}
      >
        Near me
      </button>
    </div>
  )
}
