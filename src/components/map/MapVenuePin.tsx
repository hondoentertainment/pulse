import { Venue } from '@/lib/types'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistance } from '@/lib/units'
import { triggerHapticFeedback } from '@/lib/haptics'
import type { UnitSystem } from '@/hooks/use-unit-preference'
import { getEnergyColor, getCategoryIcon, type VenueRenderPoint } from './shared'

interface MapVenuePinSVGProps {
  singles: VenueRenderPoint[]
  hoveredVenue: Venue | null
  isCameraMoving: boolean
  accessibilityMode: boolean
  zoom: number
}

export function MapVenuePinSVG({
  singles,
  hoveredVenue,
  isCameraMoving,
  accessibilityMode,
  zoom,
}: MapVenuePinSVGProps) {
  return (
    <>
      {singles.map(({ venue, x, y }) => {
        const baseSize = accessibilityMode ? 24 : 18
        const scale = venue.pulseScore > 0 ? 1 + (venue.pulseScore / 100) : 1
        const markerSize = baseSize * zoom * scale * 0.6
        const isHighlighted = hoveredVenue?.id === venue.id
        const isHighEnergy = venue.pulseScore >= 80
        const hasRecentActivity = venue.lastActivity
          ? (Date.now() - new Date(venue.lastActivity).getTime()) < 10 * 60 * 1000
          : venue.pulseScore >= 50

        const Icon = getCategoryIcon(venue.category)
        const iconSize = markerSize * 1.2

        return (
          <g key={venue.id} className="pointer-events-none">
            {isHighEnergy && !isCameraMoving && !accessibilityMode && (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={markerSize * 2.5}
                  fill={getEnergyColor(venue.pulseScore)}
                  opacity={0.15}
                  className="animate-pulse-glow"
                  style={{ animationDuration: '3s' }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={markerSize * 1.8}
                  fill={getEnergyColor(venue.pulseScore)}
                  opacity={0.25}
                  className="animate-pulse"
                  style={{ animationDuration: '2s' }}
                />
              </>
            )}

            <circle
              cx={x}
              cy={y}
              r={markerSize}
              fill={venue.pulseScore > 0 ? getEnergyColor(venue.pulseScore) : 'oklch(0.25 0.05 260)'}
              stroke={isHighlighted ? 'white' : 'oklch(0.15 0 0)'}
              strokeWidth={isHighlighted ? 3 : 1.5}
              className="transition-all duration-300"
              filter={venue.pulseScore >= 30 ? `drop-shadow(0 0 ${venue.pulseScore >= 80 ? '8px' : '4px'} ${venue.pulseScore >= 80 ? 'rgba(217, 70, 239, 0.6)' : venue.pulseScore >= 60 ? 'rgba(244, 63, 94, 0.5)' : 'rgba(14, 165, 233, 0.4)'})` : undefined}
            />

            <foreignObject
              x={x - iconSize / 2}
              y={y - iconSize / 2}
              width={iconSize}
              height={iconSize}
              className="pointer-events-none"
            >
              <div className="w-full h-full flex items-center justify-center text-white">
                <Icon
                  weight="fill"
                  className={cn(
                    "w-full h-full drop-shadow-md",
                    venue.pulseScore === 0 && "text-white/50"
                  )}
                />
              </div>
            </foreignObject>

            {hasRecentActivity && !isCameraMoving && !accessibilityMode && (
              <circle
                cx={x}
                cy={y}
                r={markerSize * 1.5}
                fill="none"
                stroke={getEnergyColor(venue.pulseScore)}
                strokeWidth={2}
                opacity={0}
                className="animate-ping"
                style={{ animationDuration: '1.5s' }}
              />
            )}
          </g>
        )
      })}
    </>
  )
}

interface MapVenuePinLabelsProps {
  singles: VenueRenderPoint[]
  labelVenueIds: Set<string>
  hoveredVenue: Venue | null
  unitSystem: UnitSystem
  onVenueClick: (venue: Venue) => void
  onHoverVenue: (venue: Venue | null) => void
  showRevealAnimation?: boolean
}

export function MapVenuePinLabels({
  singles,
  labelVenueIds,
  hoveredVenue,
  unitSystem,
  onVenueClick,
  onHoverVenue,
  showRevealAnimation,
}: MapVenuePinLabelsProps) {
  return (
    <>
      {singles.map(({ venue, x, y, distance }) => {
        const showLabel = labelVenueIds.has(venue.id) || venue.pulseScore >= 75
        const isHovered = hoveredVenue?.id === venue.id

        return (
          <motion.div
            key={venue.id}
            className="absolute pointer-events-none"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)'
            }}
            initial={showRevealAnimation ? { opacity: 0, scale: 0.6 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <button
              className="pointer-events-auto relative z-20 cursor-pointer hover:scale-110 transition-transform"
              onMouseEnter={() => onHoverVenue(venue)}
              onMouseLeave={() => onHoverVenue(null)}
              onClick={() => {
                triggerHapticFeedback('medium')
                onVenueClick(venue)
              }}
            >
              <div className="w-10 h-10" />
            </button>
            <AnimatePresence>
              {showLabel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 5 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10"
                >
                  {isHovered && (
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 w-0.5 h-3 bg-gradient-to-t from-border to-transparent mb-0.5 origin-bottom"
                    />
                  )}
                  <div className={cn(
                    "bg-card/95 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 shadow-lg transition-all",
                    isHovered && "bg-card border-accent shadow-2xl scale-110",
                    venue.pulseScore >= 70 && "border-accent/50"
                  )}>
                    <p className="text-xs font-bold">{venue.name}</p>
                    <div className="flex items-center gap-2">
                      {venue.category && (
                        <p className="text-[10px] text-muted-foreground uppercase font-mono">
                          {venue.category}
                        </p>
                      )}
                      {distance !== undefined && (
                        <>
                          {venue.category && (
                            <span className="text-[10px] text-muted-foreground">&bull;</span>
                          )}
                          <p className="text-[10px] text-accent font-mono font-bold">
                            {formatDistance(distance, unitSystem)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </>
  )
}
