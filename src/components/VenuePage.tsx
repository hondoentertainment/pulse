import { Venue, PulseWithUser, User, PresenceData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { PulseScore } from '@/components/PulseScore'
import { PulseCard } from '@/components/PulseCard'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { Plus, MapPin, ArrowLeft, Clock, Star, Phone, Globe, HeartStraight } from '@phosphor-icons/react'
import { formatDistance } from '@/lib/units'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { WhoIsHereRow } from './WhoIsHereRow'

interface VenuePageProps {
  venue: Venue
  venuePulses: PulseWithUser[]
  distance?: number
  unitSystem: 'imperial' | 'metric'
  locationName: string
  currentTime: Date
  isTracking: boolean
  hasRealtimeLocation: boolean
  isFavorite: boolean
  isFollowed?: boolean
  currentUser?: User | null
  onBack: () => void
  onCreatePulse: () => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  onToggleFavorite: () => void
  onToggleFollow?: () => void
  presenceData?: PresenceData | null
  onOpenPresence: () => void
}

export function VenuePage({
  venue,
  venuePulses,
  distance,
  unitSystem,
  locationName,
  currentTime,
  isTracking,
  hasRealtimeLocation,
  isFavorite,
  isFollowed,
  currentUser,
  onBack,
  onCreatePulse,
  onReaction,
  onToggleFavorite,
  onToggleFollow,
  presenceData,
  onOpenPresence
}: VenuePageProps) {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{venue.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {venue.category && (
                  <span className="font-mono uppercase">{venue.category}</span>
                )}
                {distance !== undefined && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <MapPin size={14} weight="fill" />
                      <span>{formatDistance(distance, unitSystem)} away</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onToggleFollow && (
                <button
                  onClick={onToggleFollow}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <HeartStraight
                    size={24}
                    weight={isFollowed ? 'fill' : 'regular'}
                    className={isFollowed ? 'text-primary' : 'text-muted-foreground'}
                  />
                </button>
              )}
              <button
                onClick={onToggleFavorite}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <Star
                  size={24}
                  weight={isFavorite ? 'fill' : 'regular'}
                  className={isFavorite ? 'text-accent' : 'text-muted-foreground'}
                />
              </button>
              <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground font-mono">
            {locationName && (
              <div className="flex items-center gap-1.5">
                <MapPin size={12} weight="fill" className={cn(
                  "transition-colors",
                  isTracking ? "text-accent animate-pulse" : "text-muted-foreground"
                )} />
                <span>{locationName}</span>
                {hasRealtimeLocation && (
                  <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-md uppercase font-bold">
                    LIVE
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock size={12} weight="fill" className="text-accent" />
              <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto px-4 py-6 space-y-6"
      >
        {(venue.location.address || venue.phone || venue.website || venue.hours) && (
          <>
            <Card className="p-4 space-y-4 bg-card border-border">
              <h3 className="text-lg font-bold">Venue Details</h3>

              {venue.location.address && (
                <div className="flex items-start gap-3">
                  <MapPin size={20} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p className="text-sm">{venue.location.address}</p>
                  </div>
                </div>
              )}

              {venue.phone && (
                <div className="flex items-start gap-3">
                  <Phone size={20} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <a
                      href={`tel:${venue.phone}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {venue.phone}
                    </a>
                  </div>
                </div>
              )}

              {venue.website && (
                <div className="flex items-start gap-3">
                  <Globe size={20} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Website</p>
                    <a
                      href={venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {venue.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
              )}

              {venue.hours && (
                <div className="flex items-start gap-3">
                  <Clock size={20} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Hours</p>
                    <div className="space-y-1.5">
                      {Object.entries(venue.hours).map(([day, hours]) => {
                        const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
                        const isToday = day === currentDay
                        return (
                          <div
                            key={day}
                            className={cn(
                              "flex justify-between text-sm",
                              isToday && "font-bold text-accent"
                            )}
                          >
                            <span className="capitalize">{day}</span>
                            <span className={cn(
                              hours === 'Closed' && "text-muted-foreground"
                            )}>{hours}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Separator />
          </>
        )}

        {presenceData && (
          <WhoIsHereRow
            presence={presenceData}
            onClick={onOpenPresence}
          />
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Live Energy</h2>
            {venue.lastPulseAt && (
              <p className="text-sm text-muted-foreground">
                Last pulse {formatTimeAgo(venue.lastPulseAt)}
              </p>
            )}
          </div>
          <Button
            onClick={onCreatePulse}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus size={20} weight="bold" className="mr-2" />
            Create Pulse
          </Button>
        </div>

        <ScoreBreakdown venue={venue} pulses={venuePulses.map(p => ({ ...p }))} />

        <Separator />

        {venuePulses.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-lg text-muted-foreground">No pulses yet</p>
            <p className="text-sm text-muted-foreground">
              Be the first to capture the vibe here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {venuePulses.map((pulse) => (
              <PulseCard
                key={pulse.id}
                pulse={pulse}
                allPulses={venuePulses}
                onReaction={(type) => onReaction(pulse.id, type)}
                currentUserId={currentUser?.id}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
