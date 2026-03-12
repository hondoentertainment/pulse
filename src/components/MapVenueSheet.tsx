import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/lib/units'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { getEnergyLabel } from '@/lib/pulse-engine'
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion'
import { useState, useRef } from 'react'
import {
  MapPin, NavigationArrow, Users, Lightning, Fire,
  X, ArrowRight, Clock, CaretUp, CaretDown,
  BeerBottle, MusicNotes, ForkKnife, Coffee, Martini, Confetti
} from '@phosphor-icons/react'

interface MapVenueSheetProps {
  venue: Venue | null
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onClose: () => void
  onVenueClick: (venue: Venue) => void
  onViewDetails: (venue: Venue) => void
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number
}

const getCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'bar': return BeerBottle
    case 'club': case 'nightclub': return MusicNotes
    case 'restaurant': case 'food': return ForkKnife
    case 'cafe': return Coffee
    case 'lounge': return Martini
    case 'event': return Confetti
    default: return MapPin
  }
}

function VenuePreviewCard({
  venue,
  distance,
  onViewDetails,
  unitSystem,
}: {
  venue: Venue
  distance?: number
  onViewDetails: () => void
  unitSystem: 'imperial' | 'metric'
}) {
  const Icon = getCategoryIcon(venue.category)
  const energyLabel = getEnergyLabel(venue.pulseScore)
  const isHot = venue.pulseScore >= 70

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="relative"
    >
      {/* Energy accent bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-0.5 rounded-t-xl",
          venue.pulseScore >= 80 ? "bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-500" :
          venue.pulseScore >= 60 ? "bg-gradient-to-r from-rose-500 to-orange-400" :
          venue.pulseScore >= 30 ? "bg-gradient-to-r from-sky-500 to-blue-400" :
          "bg-muted"
        )}
      />

      <div className="p-4 pt-3">
        <div className="flex items-start gap-3">
          {/* Category icon */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            venue.pulseScore >= 80 ? "bg-fuchsia-500/15 text-fuchsia-400" :
            venue.pulseScore >= 60 ? "bg-rose-500/15 text-rose-400" :
            venue.pulseScore >= 30 ? "bg-sky-500/15 text-sky-400" :
            "bg-muted text-muted-foreground"
          )}>
            <Icon size={24} weight="fill" />
          </div>

          {/* Venue info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base truncate">{venue.name}</h3>
              {isHot && <Fire size={16} weight="fill" className="text-orange-500 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {venue.category && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-mono border-border/50 text-muted-foreground">
                  {venue.category}
                </Badge>
              )}
              {distance !== undefined && (
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDistance(distance, unitSystem)}
                </span>
              )}
            </div>
          </div>

          {/* Pulse score */}
          <div className="flex-shrink-0">
            <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users size={14} />
            <span className="font-medium">{Math.floor(venue.pulseScore * 1.5 + 5)} here</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lightning size={14} className={venue.pulseScore > 50 ? "text-yellow-500" : ""} />
            <span className="font-medium">{energyLabel}</span>
          </div>
          {venue.lastPulseAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={14} />
              <span className="font-medium">Active</span>
            </div>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            variant="default"
            className="h-8 px-4 text-xs font-bold gap-1.5"
            onClick={onViewDetails}
          >
            View
            <ArrowRight size={14} weight="bold" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

type SheetSnap = 'closed' | 'peek' | 'half' | 'full'

export function MapVenueSheet({
  venue,
  venues,
  userLocation,
  onClose,
  onVenueClick,
  onViewDetails,
  calculateDistance: calcDist,
}: MapVenueSheetProps) {
  const { unitSystem } = useUnitPreference()
  const [snap, setSnap] = useState<SheetSnap>('peek')
  const dragControls = useDragControls()
  const sheetRef = useRef<HTMLDivElement>(null)

  // Get nearby venues sorted by distance then score
  const nearbyVenues = userLocation
    ? venues
        .map(v => ({
          venue: v,
          distance: calcDist(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng)
        }))
        .filter(v => v.distance < 50)
        .sort((a, b) => b.venue.pulseScore - a.venue.pulseScore)
        .slice(0, 15)
    : venues
        .sort((a, b) => b.pulseScore - a.pulseScore)
        .slice(0, 15)
        .map(v => ({ venue: v, distance: undefined as number | undefined }))

  const snapToHeight: Record<SheetSnap, string> = {
    closed: '0px',
    peek: '180px',
    half: '50vh',
    full: '85vh',
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.y
    const offset = info.offset.y

    if (velocity > 500 || offset > 100) {
      // Dragging down
      if (snap === 'full') setSnap('half')
      else if (snap === 'half') setSnap('peek')
      else setSnap('closed')
    } else if (velocity < -500 || offset < -100) {
      // Dragging up
      if (snap === 'peek') setSnap('half')
      else if (snap === 'half') setSnap('full')
    }
  }

  const selectedDistance = venue && userLocation
    ? calcDist(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
    : undefined

  return (
    <AnimatePresence>
      {(venue || snap !== 'closed') && (
        <motion.div
          ref={sheetRef}
          initial={{ height: '0px' }}
          animate={{ height: snapToHeight[venue ? snap : 'closed'] }}
          exit={{ height: '0px' }}
          transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          className="absolute bottom-0 left-0 right-0 z-30 bg-card/98 backdrop-blur-xl border-t border-border/50 rounded-t-2xl overflow-hidden"
          style={{ maxHeight: '85vh' }}
        >
          {/* Drag handle */}
          <motion.div
            className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0}
            onDragEnd={handleDragEnd}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </motion.div>

          {/* Sheet header with toggle */}
          <div className="flex items-center justify-between px-4 pb-2">
            <button
              onClick={() => {
                if (snap === 'peek') setSnap('half')
                else if (snap === 'half') setSnap('full')
                else setSnap('half')
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              {snap === 'full' ? (
                <CaretDown size={14} weight="bold" />
              ) : (
                <CaretUp size={14} weight="bold" />
              )}
              {venue ? 'Selected Venue' : `${nearbyVenues.length} Nearby`}
            </button>
            {venue && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-secondary transition-colors"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 48px)' }}>
            {/* Selected venue preview */}
            {venue && (
              <div className="border-b border-border/30">
                <VenuePreviewCard
                  venue={venue}
                  distance={selectedDistance}
                  onViewDetails={() => onViewDetails(venue)}
                  unitSystem={unitSystem}
                />
              </div>
            )}

            {/* Nearby venues list (shown when expanded) */}
            {snap !== 'peek' && (
              <div className="px-4 py-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {venue ? 'More Nearby' : 'Nearby Venues'}
                </h4>
                <div className="space-y-1">
                  {nearbyVenues
                    .filter(v => v.venue.id !== venue?.id)
                    .map(({ venue: v, distance }, i) => {
                      const VIcon = getCategoryIcon(v.category)
                      return (
                        <motion.button
                          key={v.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => onVenueClick(v)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                            v.pulseScore >= 80 ? "bg-fuchsia-500/10 text-fuchsia-400" :
                            v.pulseScore >= 60 ? "bg-rose-500/10 text-rose-400" :
                            v.pulseScore >= 30 ? "bg-sky-500/10 text-sky-400" :
                            "bg-muted text-muted-foreground"
                          )}>
                            <VIcon size={18} weight="fill" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{v.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {v.category && (
                                <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                  {v.category}
                                </span>
                              )}
                              {distance !== undefined && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {formatDistance(distance, unitSystem)}
                                </span>
                              )}
                            </div>
                          </div>
                          <PulseScore score={v.pulseScore} size="xs" showLabel={false} />
                        </motion.button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
