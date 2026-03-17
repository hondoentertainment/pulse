import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Fire, Users, Lightning } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/lib/units'
import type { UnitSystem } from '@/hooks/use-unit-preference'
import { MAP_SCALE } from './shared'

interface MapVenueSheetProps {
  hoveredVenue: Venue | null
  isDragging: boolean
  isCameraMoving: boolean
  center: { lat: number; lng: number }
  zoom: number
  dimensions: { width: number; height: number }
  userLocation: { lat: number; lng: number } | null
  unitSystem: UnitSystem
}

function latLngToPixel(
  lat: number,
  lng: number,
  mapCenter: { lat: number; lng: number },
  mapZoom: number,
  dims: { width: number; height: number }
) {
  const scale = MAP_SCALE * mapZoom
  return {
    x: dims.width / 2 + (lng - mapCenter.lng) * scale,
    y: dims.height / 2 - (lat - mapCenter.lat) * scale
  }
}

function calculateDistance(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 3958.8
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function MapVenueSheet({
  hoveredVenue,
  isDragging,
  isCameraMoving,
  center,
  zoom,
  dimensions,
  userLocation,
  unitSystem,
}: MapVenueSheetProps) {
  return (
    <AnimatePresence>
      {hoveredVenue && !isDragging && !isCameraMoving && (() => {
        const pos = latLngToPixel(
          hoveredVenue.location.lat,
          hoveredVenue.location.lng,
          center, zoom, dimensions
        )

        const distance = userLocation
          ? calculateDistance(
            userLocation.lat, userLocation.lng,
            hoveredVenue.location.lat, hoveredVenue.location.lng
          )
          : undefined

        const tooltipWidth = 240
        const tooltipHeight = 100
        const padding = 16

        let left = pos.x
        let top = pos.y - tooltipHeight - 20

        if (left - tooltipWidth / 2 < padding) {
          left = tooltipWidth / 2 + padding
        } else if (left + tooltipWidth / 2 > dimensions.width - padding) {
          left = dimensions.width - tooltipWidth / 2 - padding
        }

        if (top < padding) {
          top = pos.y + 30
        }

        return (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute pointer-events-none z-50"
            style={{
              left,
              top,
              width: tooltipWidth,
              transform: 'translateX(-50%)'
            }}
          >
            <Card className="bg-card/98 backdrop-blur-md border-border shadow-2xl relative overflow-hidden">
              {/* Header Decoration */}
              <div
                className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  hoveredVenue.pulseScore >= 80 ? "bg-gradient-to-r from-fuchsia-500 to-cyan-500" :
                    hoveredVenue.pulseScore >= 60 ? "bg-rose-500" :
                      hoveredVenue.pulseScore >= 30 ? "bg-sky-500" : "bg-slate-700"
                )}
              />

              <div className="p-3 pt-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="font-bold text-sm truncate">{hoveredVenue.name}</h3>
                      {hoveredVenue.pulseScore >= 80 && (
                        <Fire size={14} weight="fill" className="text-orange-500 animate-pulse" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-mono border-accent/30 text-accent bg-accent/5">
                        {hoveredVenue.category || 'Venue'}
                      </Badge>
                      {distance !== undefined && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatDistance(distance, unitSystem)}
                        </span>
                      )}
                    </div>
                  </div>
                  <PulseScore score={hoveredVenue.pulseScore} size="sm" showLabel={false} />
                </div>

                {hoveredVenue.location.address && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin size={12} weight="fill" />
                    <p className="text-[10px] line-clamp-1">
                      {hoveredVenue.location.address}
                    </p>
                  </div>
                )}

                {/* Social Signals */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users size={12} />
                      <span className="font-medium">{Math.floor(hoveredVenue.pulseScore * 1.5 + 5)} here</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Lightning size={12} className={hoveredVenue.pulseScore > 50 ? "text-yellow-500" : ""} />
                      <span className="font-medium">{hoveredVenue.pulseScore > 80 ? "Trending" : hoveredVenue.pulseScore > 50 ? "Active" : "Quiet"}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-primary font-bold cursor-pointer hover:underline">View</span>
                </div>
              </div>
              {/* Pointer arrow */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-card/98"
                style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}
              />
            </Card>
          </motion.div>
        )
      })()}
    </AnimatePresence>
  )
}
