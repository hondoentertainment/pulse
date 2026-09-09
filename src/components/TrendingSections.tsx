import { Pulse, Venue } from '@/lib/types'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { TrendUp, Users, Clock } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { EnergyBadge } from '@/components/EnergyBadge'
import { calculateScoreVelocity } from '@/lib/venue-trending'
import { getEnergyLabel } from '@/lib/pulse-engine'

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
  isFollowed?: (venueId: string) => boolean
  onToggleFollow?: (venueId: string) => void
}

function getSectionIcon(title: string) {
  switch (title) {
    case 'Trending Now':
      return <span aria-hidden>🔥</span>
    case 'Just Popped Off':
      return <span aria-hidden>⚡</span>
    case 'Gaining Energy':
      return <span aria-hidden>↗</span>
    case 'Expected to Be Busy':
      return <Users size={20} weight="duotone" className="text-muted-foreground" />
    default:
      return <TrendUp size={20} weight="fill" />
  }
}

function getSectionShortTitle(title: string) {
  switch (title) {
    case 'Just Popped Off':
      return 'Just Popped'
    case 'Gaining Energy':
      return 'Gaining'
    case 'Trending Now':
      return 'Trending Now'
    default:
      return title
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
  onVenueClick,
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
                const velocity = calculateScoreVelocity(venue, pulses)
                const energyLabel = getEnergyLabel(venue.pulseScore)
                const place = venue.neighborhood || venue.city
                const metaParts = [
                  velocity > 0 ? `Surge +${Math.round(velocity)}` : `${venue.pulseScore} score`,
                  place,
                ].filter(Boolean)

                return (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => onVenueClick(venue)}
                    className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-card/80 px-4 py-3.5 text-left transition-colors hover:border-white/20"
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold">
                        {getSectionShortTitle(section.title)} — {venue.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {metaParts.join(' · ')}
                      </p>
                    </div>
                    <EnergyBadge label={energyLabel} className="shrink-0" />
                  </button>
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
