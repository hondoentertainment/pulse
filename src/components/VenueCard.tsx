import { Venue } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { PulseScore } from './PulseScore'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, Star } from '@phosphor-icons/react'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { formatDistance } from '@/lib/units'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { getPreTrendingLabel } from '@/lib/venue-trending'
import { motion } from 'framer-motion'

interface VenueCardProps {
  venue: Venue
  distance?: number
  onClick?: () => void
  isJustPopped?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (venueId: string) => void
  showPreTrendingLabel?: boolean
}

export function VenueCard({ venue, distance, onClick, isJustPopped, isFavorite, onToggleFavorite, showPreTrendingLabel }: VenueCardProps) {
  const { unitSystem } = useUnitPreference()
  const preTrendingLabel = showPreTrendingLabel && venue.preTrending ? getPreTrendingLabel(venue) : null
  
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className="p-5 cursor-pointer border-border hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/20 relative"
        onClick={onClick}
      >
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(venue.id)
            }}
            className="absolute top-3 right-3 p-2 rounded-lg hover:bg-secondary transition-colors z-10"
          >
            <Star
              size={18}
              weight={isFavorite ? 'fill' : 'regular'}
              className={isFavorite ? 'text-accent' : 'text-muted-foreground'}
            />
          </button>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3 pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold">{venue.name}</h3>
                {isJustPopped && (
                  <Badge className="bg-accent text-accent-foreground animate-pulse-glow text-xs">
                    Just Popped
                  </Badge>
                )}
                {preTrendingLabel && (
                  <Badge variant="outline" className="text-xs border-dashed border-muted-foreground/50 text-muted-foreground">
                    {preTrendingLabel}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase">
                {venue.category && (
                  <span className="tracking-wider">{venue.category}</span>
                )}
                {distance !== undefined && (
                  <div className="flex items-center gap-1">
                    <MapPin size={12} weight="fill" />
                    <span>{formatDistance(distance, unitSystem)}</span>
                  </div>
                )}
              </div>
            </div>

            {venue.lastPulseAt && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock size={14} weight="fill" />
                <span>Last pulse {formatTimeAgo(venue.lastPulseAt)}</span>
              </div>
            )}
          </div>

          <div className="flex-shrink-0">
            <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
