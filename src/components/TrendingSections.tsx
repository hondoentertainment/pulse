import { Pulse, Venue } from '@/lib/types'
import { VenueCard } from './VenueCard'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { TrendUp, Lightning, Flame, Users, Clock } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

export interface TrendingSection {
  title: string
  venues: Venue[]
  description: string
  updatedAt: string
}

interface TrendingSectionsProps {
  sections: TrendingSection[]
  pulses?: Pulse[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  isFavorite: (venueId: string) => boolean
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

function getSectionIcon(title: string) {
  switch (title) {
    case 'Trending Now':
      return <TrendUp size={20} weight="fill" className="text-accent" />
    case 'Just Popped Off':
      return <Lightning size={20} weight="fill" className="text-[oklch(0.70_0.22_60)]" />
    case 'Gaining Energy':
      return <Flame size={20} weight="fill" className="text-primary" />
    case 'Expected to Be Busy':
      return <Users size={20} weight="duotone" className="text-muted-foreground" />
    default:
      return <TrendUp size={20} weight="fill" />
  }
}

function getTimeSinceUpdate(updatedAt: string): string {
  const now = new Date()
  const updated = new Date(updatedAt)
  const minutesAgo = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60))
  
  if (minutesAgo < 1) return 'Just now'
  if (minutesAgo === 1) return '1 minute ago'
  if (minutesAgo < 60) return `${minutesAgo} minutes ago`
  
  const hoursAgo = Math.floor(minutesAgo / 60)
  if (hoursAgo === 1) return '1 hour ago'
  return `${hoursAgo} hours ago`
}

export function TrendingSections({
  sections,
  pulses = [],
  userLocation,
  onVenueClick,
  isFavorite,
  onToggleFavorite
}: TrendingSectionsProps) {
  if (sections.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <TrendUp size={32} weight="duotone" className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-bold mb-2">No trending venues yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Be the first to check in and post a pulse to get the energy flowing
        </p>
      </div>
    )
  }

  const mediaByVenueId = new Map<string, string>()
  for (const pulse of pulses) {
    const photo = pulse.photos?.[0]
    if (photo && !mediaByVenueId.has(pulse.venueId)) {
      mediaByVenueId.set(pulse.venueId, photo)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {sections.map((section, index) => {
        const isPreTrending = section.title === 'Expected to Be Busy'
        
        return (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getSectionIcon(section.title)}
                <h2 className="text-xl font-bold">{section.title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Clock size={12} weight="fill" className="text-accent" />
                  <span>{getTimeSinceUpdate(section.updatedAt)}</span>
                </div>
              </div>
              {isPreTrending && (
                <Badge variant="outline" className="text-xs border-dashed border-muted-foreground/50 text-muted-foreground">
                  Suggested • Not verified
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              {section.venues.map((venue) => {
                const distance = userLocation
                  ? calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      venue.location.lat,
                      venue.location.lng
                    )
                  : undefined

                return (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    distance={distance}
                    mediaUrl={mediaByVenueId.get(venue.id)}
                    onClick={() => onVenueClick(venue)}
                    isJustPopped={section.title === 'Just Popped Off'}
                    isFavorite={isFavorite(venue.id)}
                    onToggleFavorite={onToggleFavorite}
                    showPreTrendingLabel={isPreTrending}
                  />
                )
              })}
            </div>

            {index < sections.length - 1 && <Separator className="mt-6" />}
          </motion.div>
        )
      })}
    </div>
  )
}
