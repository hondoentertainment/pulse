import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { Card } from '@/components/ui/card'
import { Star, MapPin } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { formatDistance } from '@/lib/units'

interface FavoritesProps {
  favoriteVenues: Venue[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  onVenueClick: (venue: Venue) => void
  onToggleFavorite: (venueId: string) => void
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export function Favorites({
  favoriteVenues,
  userLocation,
  unitSystem,
  onVenueClick,
  onToggleFavorite
}: FavoritesProps) {
  if (favoriteVenues.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center space-y-2">
        <Star size={48} weight="duotone" className="mx-auto text-muted-foreground opacity-50" />
        <p className="font-semibold">Build your shortlist</p>
        <p className="text-sm text-muted-foreground">
          Star venues you care about and they will stay one tap away here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {favoriteVenues.slice(0, 4).map((venue, index) => {
        const distance = userLocation
          ? calculateDistance(
              userLocation.lat,
              userLocation.lng,
              venue.location.lat,
              venue.location.lng
            )
          : undefined

        return (
          <motion.div
            key={venue.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className="relative p-4 cursor-pointer hover:bg-card/80 transition-colors border-border/50 bg-gradient-to-br from-card to-card/50"
              onClick={() => onVenueClick(venue)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(venue.id)
                }}
                aria-label={`Remove ${venue.name} from favorites`}
                className="absolute top-2 right-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-colors hover:bg-background"
              >
                <Star size={16} weight="fill" className="text-accent" />
              </button>

              <div className="space-y-3">
                <div className="flex items-start justify-between pr-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{venue.name}</h3>
                    {venue.category && (
                      <p className="text-xs text-muted-foreground font-mono uppercase mt-0.5">
                        {venue.category}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <PulseScore score={venue.pulseScore} size="lg" showLabel={false} />
                </div>

                {distance !== undefined && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center">
                    <MapPin size={12} weight="fill" />
                    <span>{formatDistance(distance, unitSystem)}</span>
                  </div>
                )}

                {venue.lastPulseAt && (
                  <p className="text-xs text-muted-foreground text-center">
                    {formatTimeAgo(venue.lastPulseAt)}
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
