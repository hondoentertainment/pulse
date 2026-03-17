import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/lib/units'
import { triggerHapticFeedback } from '@/lib/haptics'
import { getHeadingDelta } from '@/lib/interactive-map'
import type { UnitSystem } from '@/hooks/use-unit-preference'
import type { VenueRenderPoint } from './shared'

function calculateBearing(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const l1 = (lon1 * Math.PI) / 180
  const l2 = (lon2 * Math.PI) / 180
  const y = Math.sin(l2 - l1) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1)
  const t = Math.atan2(y, x)
  return ((t * 180) / Math.PI + 360) % 360
}

interface MapSmartRouteProps {
  previewVenues: VenueRenderPoint[]
  bestNextVenue: VenueRenderPoint | null
  comparedVenues: VenueRenderPoint[]
  comparedVenueIds: string[]
  hoveredVenue: Venue | null
  userLocation: { lat: number; lng: number } | null
  locationHeading: number | null | undefined
  unitSystem: UnitSystem
  onVenueSelect: (venue: Venue) => void
  onVenueClick: (venue: Venue) => void
  onSmartRoute: () => void
  onToggleCompare: (venueId: string) => void
  onClearCompare: () => void
}

export function MapSmartRoute({
  previewVenues,
  bestNextVenue,
  comparedVenues,
  comparedVenueIds,
  hoveredVenue,
  userLocation,
  locationHeading,
  unitSystem,
  onVenueSelect,
  onVenueClick,
  onSmartRoute,
  onToggleCompare,
  onClearCompare,
}: MapSmartRouteProps) {
  if (previewVenues.length === 0) return null

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(94%,720px)] pointer-events-none">
      {bestNextVenue && (
        <Card className="pointer-events-auto mb-2 p-2.5 bg-card/95 backdrop-blur-sm border border-border shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-foreground">Smart Route</p>
              <p className="text-[10px] text-muted-foreground">
                Best next stop: {bestNextVenue.venue.name}
              </p>
            </div>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={onSmartRoute}
            >
              Take Me
            </Button>
          </div>
        </Card>
      )}
      <AnimatePresence>
        {comparedVenues.length > 0 && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="pointer-events-auto mb-2 p-2.5 bg-card/95 backdrop-blur-sm border border-border shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-foreground">
                  Compare ({comparedVenues.length}/3)
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={onClearCompare}
                >
                  Clear
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {comparedVenues.map((point) => (
                  <motion.button
                    layout
                    key={`compare-${point.venue.id}`}
                    className="text-left rounded-md border border-border/70 bg-background/40 px-2 py-1.5 hover:bg-background/60 transition-colors"
                    onClick={() => onVenueClick(point.venue)}
                  >
                    <p className="text-[11px] font-semibold truncate">{point.venue.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase truncate">
                      {point.venue.category || 'Venue'}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <PulseScore score={point.venue.pulseScore} size="xs" showLabel={false} />
                      {point.distance !== undefined && (
                        <span className="text-[10px] text-accent font-mono">
                          {formatDistance(point.distance, unitSystem)}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex gap-2 overflow-x-auto pb-1 px-1">
        {previewVenues.map((point) => {
          const isCompared = comparedVenueIds.includes(point.venue.id)
          const headingDelta = (locationHeading !== null && locationHeading !== undefined && userLocation)
            ? getHeadingDelta(calculateBearing(
              userLocation.lat,
              userLocation.lng,
              point.venue.location.lat,
              point.venue.location.lng
            ), locationHeading)
            : null
          const isAhead = headingDelta !== null && headingDelta < 30

          return (
            <motion.div layout key={`preview-wrap-${point.venue.id}`}>
              <Card
                className={cn(
                  "pointer-events-auto min-w-[180px] p-2.5 bg-card/95 backdrop-blur-sm border border-border shadow-lg",
                  hoveredVenue?.id === point.venue.id && "border-accent/70 shadow-accent/30",
                  isCompared && "border-primary/70 shadow-primary/20"
                )}
              >
                <button
                  className="w-full text-left"
                  onClick={() => onVenueSelect(point.venue)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{point.venue.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase truncate">
                        {point.venue.category || 'Venue'}
                      </p>
                      {isAhead && (
                        <Badge variant="secondary" className="mt-1 text-[9px] h-4 px-1.5 bg-primary/15 text-primary border-primary/25">
                          Ahead
                        </Badge>
                      )}
                      {point.distance !== undefined && (
                        <p className="text-[10px] text-accent font-mono mt-0.5">
                          {formatDistance(point.distance, unitSystem)}
                        </p>
                      )}
                    </div>
                    <PulseScore score={point.venue.pulseScore} size="xs" showLabel={false} />
                  </div>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-7 w-full text-[11px]"
                  onClick={() => {
                    triggerHapticFeedback('medium')
                    onVenueClick(point.venue)
                  }}
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant={isCompared ? "default" : "ghost"}
                  className="mt-1 h-7 w-full text-[11px]"
                  onClick={() => onToggleCompare(point.venue.id)}
                >
                  {isCompared ? 'Compared' : 'Compare'}
                </Button>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
