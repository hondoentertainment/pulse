import { Venue } from '@/lib/types'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { PulseScore } from './PulseScore'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, Star, HeartStraight, Broadcast, Queue } from '@phosphor-icons/react'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { formatDistance } from '@/lib/units'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { getPreTrendingLabel } from '@/lib/venue-trending'
import { getContextualLabel } from '@/lib/time-contextual-scoring'
import { motion } from 'framer-motion'

interface VenueCardProps {
  venue: Venue
  distance?: number
  onClick?: () => void
  isJustPopped?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (venueId: string) => void
  isFollowed?: boolean
  onToggleFollow?: (venueId: string) => void
  showPreTrendingLabel?: boolean
  mediaUrl?: string
}

export function VenueCard({ venue, distance, onClick, isJustPopped, isFavorite, onToggleFavorite, isFollowed, onToggleFollow, showPreTrendingLabel, mediaUrl }: VenueCardProps) {
  const { unitSystem } = useUnitPreference()
  const preTrendingLabel = showPreTrendingLabel && venue.preTrending ? getPreTrendingLabel(venue) : null
  const contextualLabel = venue.pulseScore >= 25 ? getContextualLabel(venue) : ''
  const liveReportCount = venue.liveSummary?.reportCount ?? 0
  
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className="group cursor-pointer overflow-hidden border-border/70 bg-card/90 p-0 transition-all duration-300 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/15"
        onClick={onClick}
      >
        <div className="relative h-36 overflow-hidden bg-secondary">
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in oklch, var(--primary) 62%, black), color-mix(in oklch, var(--accent) 45%, black))',
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/25 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isJustPopped && (
                  <Badge className="bg-accent text-accent-foreground text-xs shadow-lg shadow-accent/20">
                    Just popped
                  </Badge>
                )}
                {liveReportCount > 0 && (
                  <Badge variant="outline" className="border-white/25 bg-black/35 text-xs text-white backdrop-blur">
                    <Broadcast size={11} weight="fill" className="mr-1" />
                    Live
                  </Badge>
                )}
              </div>
              <h3 className="mt-1 truncate text-2xl font-bold text-white drop-shadow">{venue.name}</h3>
            </div>
            <div className="rounded-2xl bg-black/45 p-2 backdrop-blur">
              <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
            </div>
          </div>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          {onToggleFollow && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleFollow(venue.id)
              }}
              aria-label={isFollowed ? `Unfollow ${venue.name}` : `Follow ${venue.name}`}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            >
              <HeartStraight
                size={18}
                weight={isFollowed ? 'fill' : 'regular'}
                className={isFollowed ? 'text-primary' : 'text-white'}
              />
            </button>
          )}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(venue.id)
              }}
              aria-label={isFavorite ? `Remove ${venue.name} from favorites` : `Add ${venue.name} to favorites`}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            >
              <Star
                size={18}
                weight={isFavorite ? 'fill' : 'regular'}
                className={isFavorite ? 'text-accent' : 'text-white'}
              />
            </button>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {venue.category && <span className="truncate font-semibold uppercase tracking-wide">{venue.category}</span>}
                {distance !== undefined && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} weight="fill" />
                    {formatDistance(distance, unitSystem)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {preTrendingLabel && (
                  <Badge variant="outline" className="text-xs border-dashed border-muted-foreground/50 text-muted-foreground">
                    {preTrendingLabel}
                  </Badge>
                )}
                {contextualLabel && (
                  <Badge variant="outline" className="border-accent/25 bg-accent/10 text-xs text-accent">
                    {contextualLabel}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MetricPill
              icon={<Clock size={13} weight="fill" />}
              label="Pulse"
              value={venue.lastPulseAt ? formatTimeAgo(venue.lastPulseAt) : 'Quiet'}
            />
            <MetricPill
              icon={<Queue size={13} weight="fill" />}
              label="Line"
              value={venue.liveSummary?.waitTime === null || venue.liveSummary?.waitTime === undefined
                ? 'Unknown'
                : venue.liveSummary.waitTime === 0 ? 'No wait' : `${venue.liveSummary.waitTime}m`}
            />
            <MetricPill
              icon={<Broadcast size={13} weight="fill" />}
              label="Reports"
              value={liveReportCount > 0 ? String(liveReportCount) : 'None'}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function MetricPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-background/45 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  )
}
