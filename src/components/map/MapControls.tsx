import { Venue } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  MapPin, NavigationArrow, Plus, Minus, CaretDown, CaretUp,
  BeerBottle, MusicNotes, Fire,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MapFilters, MapFiltersState } from '@/components/MapFilters'
import { MapSearch } from '@/components/MapSearch'
import { GPSIndicator } from '@/components/GPSIndicator'
import { triggerHapticFeedback } from '@/lib/haptics'

interface MapTopBarProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  statusChips: string[]
  showOnboardingTips: boolean
  tipIndex: number
  onboardingTips: string[]
  filters: MapFiltersState
  nearMeActive: boolean
  showFullHeatmap: boolean
  onVenueSelect: (venue: Venue) => void
  onFilterChange: (filters: MapFiltersState) => void
  onNearMeToggle: () => void
  onShowFullHeatmapToggle: () => void
  onTipNext: () => void
  onTipSkip: () => void
}

export function MapTopBar({
  venues,
  userLocation,
  statusChips,
  showOnboardingTips,
  tipIndex,
  onboardingTips,
  filters,
  nearMeActive,
  showFullHeatmap,
  onVenueSelect,
  onFilterChange,
  onNearMeToggle,
  onShowFullHeatmapToggle,
  onTipNext,
  onTipSkip,
}: MapTopBarProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 max-w-md">
          <MapSearch
            venues={venues}
            onVenueSelect={onVenueSelect}
            userLocation={userLocation}
          />
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap max-w-lg">
        {statusChips.map((chip) => (
          <Badge
            key={chip}
            variant="secondary"
            className="bg-card/90 backdrop-blur-sm border border-border/70 text-[10px] font-semibold"
          >
            {chip}
          </Badge>
        ))}
      </div>

      {showOnboardingTips && (
        <Card className="max-w-md bg-card/95 backdrop-blur-sm border border-border shadow-lg p-3">
          <p className="text-[11px] font-semibold text-primary mb-1.5">
            Map tips {tipIndex + 1}/{onboardingTips.length}
          </p>
          <p className="text-xs text-foreground">
            {onboardingTips[tipIndex]}
          </p>
          <div className="mt-2.5 flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={onTipSkip}
            >
              Skip
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={onTipNext}
            >
              {tipIndex >= onboardingTips.length - 1 ? 'Done' : 'Next'}
            </Button>
          </div>
        </Card>
      )}

      {/* Quick Filter Chips */}
      <div className="flex gap-1.5 flex-wrap max-w-md">
        <button
          onClick={() => {
            triggerHapticFeedback('light')
            if (filters.categories.includes('bar')) {
              onFilterChange({ ...filters, categories: filters.categories.filter(c => c !== 'bar') })
            } else {
              onFilterChange({ ...filters, categories: [...filters.categories, 'bar'] })
            }
          }}
          className={cn(
            "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
            "border backdrop-blur-sm shadow-sm",
            filters.categories.includes('bar')
              ? "bg-accent text-accent-foreground border-accent"
              : "bg-card/90 text-foreground border-border hover:bg-secondary"
          )}
        >
          <BeerBottle size={14} weight="fill" className="inline mr-1" />
          Bars
        </button>
        <button
          onClick={() => {
            triggerHapticFeedback('light')
            const hasClub = filters.categories.includes('club') || filters.categories.includes('nightclub')
            if (hasClub) {
              onFilterChange({ ...filters, categories: filters.categories.filter(c => c !== 'club' && c !== 'nightclub') })
            } else {
              onFilterChange({ ...filters, categories: [...filters.categories, 'club', 'nightclub'] })
            }
          }}
          className={cn(
            "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
            "border backdrop-blur-sm shadow-sm",
            filters.categories.includes('club') || filters.categories.includes('nightclub')
              ? "bg-accent text-accent-foreground border-accent"
              : "bg-card/90 text-foreground border-border hover:bg-secondary"
          )}
        >
          <MusicNotes size={14} weight="fill" className="inline mr-1" />
          Clubs
        </button>
        <button
          onClick={() => {
            triggerHapticFeedback('light')
            onNearMeToggle()
          }}
          className={cn(
            "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
            "border backdrop-blur-sm shadow-sm",
            nearMeActive
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card/90 text-foreground border-border hover:bg-secondary"
          )}
        >
          <MapPin size={14} weight="fill" className="inline mr-1" />
          Near Me
        </button>
        <button
          onClick={() => {
            triggerHapticFeedback('light')
            const hasHot = filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing')
            if (hasHot) {
              onFilterChange({ ...filters, energyLevels: filters.energyLevels.filter(e => e !== 'electric' && e !== 'buzzing') })
            } else {
              onFilterChange({ ...filters, energyLevels: [...filters.energyLevels, 'electric', 'buzzing'] })
            }
          }}
          className={cn(
            "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
            "border backdrop-blur-sm shadow-sm",
            filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing')
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-card/90 text-foreground border-border hover:bg-secondary"
          )}
        >
          <Fire size={14} weight="fill" className="inline mr-1" />
          Hot
        </button>
        <button
          onClick={() => {
            triggerHapticFeedback('light')
            onShowFullHeatmapToggle()
          }}
          className={cn(
            "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
            "border backdrop-blur-sm shadow-sm",
            showFullHeatmap
              ? "bg-accent text-accent-foreground border-accent"
              : "bg-card/90 text-foreground border-border hover:bg-secondary"
          )}
        >
          {showFullHeatmap ? 'Top 5' : 'Full Map'}
        </button>
      </div>
    </div>
  )
}

interface MapRightControlsProps {
  zoom: number
  followUser: boolean
  userLocation: { lat: number; lng: number } | null
  nearMeActive: boolean
  accessibilityMode: boolean
  filteredVenueCount: number
  filters: MapFiltersState
  availableCategories: string[]
  isTracking?: boolean
  locationAccuracy?: number
  totalVenueCount: number
  showLegend: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onCenterOnUser: () => void
  onNearMeToggle: () => void
  onAccessibilityToggle: () => void
  onFitToVenues: () => void
  onFilterChange: (f: MapFiltersState) => void
  onShowLegendToggle: () => void
}

export function MapRightControls({
  zoom,
  followUser,
  userLocation,
  nearMeActive,
  accessibilityMode,
  filteredVenueCount,
  filters,
  availableCategories,
  onZoomIn,
  onZoomOut,
  onCenterOnUser,
  onNearMeToggle,
  onAccessibilityToggle,
  onFitToVenues,
  onFilterChange,
  onShowLegendToggle,
}: MapRightControlsProps) {
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
      <Button
        size="sm"
        variant={accessibilityMode ? "default" : "secondary"}
        className="self-end h-10 px-3 bg-card/95 backdrop-blur-sm border border-border shadow-lg"
        onClick={onAccessibilityToggle}
      >
        A11y
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="self-end h-10 px-3 bg-card/95 backdrop-blur-sm border border-border shadow-lg"
        onClick={onFitToVenues}
      >
        <MapPin size={14} weight="fill" className="mr-1.5" />
        Fit view
      </Button>
      {!followUser && userLocation && (
        <Button
          size="sm"
          variant="secondary"
          className="self-end h-10 px-3 bg-card/95 backdrop-blur-sm border border-border shadow-lg"
          onClick={onCenterOnUser}
        >
          <NavigationArrow size={14} weight="fill" className="mr-1.5" />
          Re-center
        </Button>
      )}
      {/* Venue Count Badge */}
      <Card className="bg-card/95 backdrop-blur-sm border-border px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2">
          <MapPin size={16} weight="fill" className="text-primary" />
          <div className="text-xs">
            <span className="font-bold text-foreground">{filteredVenueCount}</span>
            <span className="text-muted-foreground ml-1">
              {filteredVenueCount === 1 ? 'venue' : 'venues'}
            </span>
          </div>
        </div>
      </Card>

      <MapFilters
        filters={filters}
        onChange={onFilterChange}
        availableCategories={availableCategories}
      />

      {/* Unified Control Group */}
      <Card className="bg-card/95 backdrop-blur-sm border-border p-1.5 shadow-lg">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 hover:bg-secondary touch-manipulation"
              onClick={onZoomIn}
              title="Zoom in (+)"
              aria-label="Zoom in"
            >
              <Plus size={18} weight="bold" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 hover:bg-secondary touch-manipulation"
              onClick={onZoomOut}
              title="Zoom out (-)"
              aria-label="Zoom out"
            >
              <Minus size={18} weight="bold" />
            </Button>
          </div>
          <div className="h-px bg-border" />
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-11 w-11 touch-manipulation",
                followUser && "bg-accent text-accent-foreground"
              )}
              onClick={onCenterOnUser}
              title="Center on me"
              aria-label="Center map on my location"
            >
              <NavigationArrow size={18} weight="fill" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-11 w-11 touch-manipulation",
                nearMeActive && "bg-accent text-accent-foreground"
              )}
              onClick={onNearMeToggle}
              title="Near me (0.5 mi)"
              aria-label="Toggle near me venues"
            >
              <MapPin size={18} weight="fill" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Zoom Level Indicator */}
      <div className="text-[10px] font-mono text-muted-foreground text-center bg-card/80 backdrop-blur-sm rounded px-2 py-1">
        {zoom.toFixed(1)}x
      </div>
      <div className="text-[10px] font-mono text-muted-foreground/80 text-center bg-card/70 backdrop-blur-sm rounded px-2 py-1">
        Drag to pan · scroll to zoom
      </div>
    </div>
  )
}

interface MapBottomLeftControlsProps {
  isTracking?: boolean
  locationAccuracy?: number
  filters: MapFiltersState
  filteredVenueCount: number
  totalVenueCount: number
  showLegend: boolean
  onShowLegendToggle: () => void
}

export function MapBottomLeftControls({
  isTracking,
  locationAccuracy,
  filters,
  filteredVenueCount,
  totalVenueCount,
  showLegend,
  onShowLegendToggle,
}: MapBottomLeftControlsProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
      <GPSIndicator isTracking={isTracking ?? false} accuracy={locationAccuracy} />

      {(filters.energyLevels.length > 0 ||
        filters.categories.length > 0 ||
        filters.maxDistance !== Infinity) && (
          <Card className="bg-card/95 backdrop-blur-sm border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filteredVenueCount}</span> of{' '}
              {totalVenueCount} venues
            </p>
          </Card>
        )}

      {/* Collapsible Legend */}
      <Card className="bg-card/95 backdrop-blur-sm border-border overflow-hidden">
        <button
          onClick={onShowLegendToggle}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors"
        >
          <span className="text-xs font-bold text-foreground">Energy Levels</span>
          {showLegend ? (
            <CaretUp size={14} className="text-muted-foreground" />
          ) : (
            <CaretDown size={14} className="text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {showLegend && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[oklch(0.35_0.05_240)] border border-border" />
                  <span className="text-xs text-muted-foreground">Dead</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[oklch(0.60_0.15_150)] border border-foreground/20" />
                  <span className="text-xs text-muted-foreground">Chill</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[oklch(0.70_0.22_60)] border border-foreground/20 shadow-sm" />
                  <span className="text-xs text-muted-foreground">Buzzing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[oklch(0.65_0.28_340)] border border-foreground/20 shadow-sm animate-pulse-glow" />
                  <span className="text-xs text-muted-foreground">Electric</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  )
}
