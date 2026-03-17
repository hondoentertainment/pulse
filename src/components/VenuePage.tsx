import { useState, useEffect, useCallback } from 'react'
import { Venue, PulseWithUser, User, PresenceData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { PulseScore } from '@/components/PulseScore'
import { PulseCard } from '@/components/PulseCard'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { ShareSheet } from '@/components/ShareSheet'
import { VenueLivePanel } from '@/components/VenueLivePanel'
import { QuickReportSheet } from '@/components/QuickReportSheet'
import { Plus, MapPin, ArrowLeft, Clock, Star, Phone, Globe, HeartStraight, Car, CalendarCheck, ShareNetwork, Ticket, CalendarBlank } from '@phosphor-icons/react'
import { formatDistance } from '@/lib/units'
import { formatTimeAgo, getContextualEnergyLabel } from '@/lib/pulse-engine'
import { generateVenueShareCard, type ShareCard } from '@/lib/sharing'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { AnimatedEmptyState } from './AnimatedEmptyState'
import { WhoIsHereRow } from './WhoIsHereRow'
import { ParallaxVenueHero } from './ParallaxVenueHero'
// Phase 2: Venue star moment
import { LiveCrowdIndicator } from './LiveCrowdIndicator'
import { VenueEnergyTimeline } from './VenueEnergyTimeline'
import { VenueQuickActions } from './VenueQuickActions'
import { VenueActivityStream } from './VenueActivityStream'
// Phase 4: Personalization
import VenueMemoryCard from './VenueMemoryCard'
import {
  getVenueLiveData,
  reportWaitTime,
  reportCoverCharge,
  reportMusicPlaying,
  reportCrowdLevel,
  reportDressCode,
  reportNowPlaying,
  seedDemoReports,
  type VenueLiveData,
} from '@/lib/live-intelligence'

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
  onOpenIntegrations?: () => void
  onGetTickets?: () => void
  onReserveTable?: () => void
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
  onOpenPresence,
  onOpenIntegrations,
  onGetTickets,
  onReserveTable,
}: VenuePageProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCard, setShareCard] = useState<ShareCard | null>(null)
  const [reportSheetOpen, setReportSheetOpen] = useState(false)
  const [liveData, setLiveData] = useState<VenueLiveData | null>(null)

  const refreshLiveData = useCallback(() => {
    setLiveData(getVenueLiveData(venue.id))
  }, [venue.id])

  useEffect(() => {
    // Seed demo data on first load for this venue
    seedDemoReports([venue.id])
    refreshLiveData()
  }, [venue.id, refreshLiveData])

  const handleShare = () => {
    const card = generateVenueShareCard(venue)
    setShareCard(card)
    setShareOpen(true)
  }

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
              <button
                onClick={handleShare}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <ShareNetwork size={24} className="text-muted-foreground" />
              </button>
              {onToggleFollow && (
                <motion.button
                  onClick={onToggleFollow}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors relative"
                  whileTap={{ scale: 0.85 }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isFollowed ? 'followed' : 'unfollowed'}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.4, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >
                      <HeartStraight
                        size={24}
                        weight={isFollowed ? 'fill' : 'regular'}
                        className={isFollowed ? 'text-primary' : 'text-muted-foreground'}
                      />
                    </motion.div>
                  </AnimatePresence>
                  {isFollowed && (
                    <motion.span
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <HeartStraight size={24} weight="fill" className="text-primary" />
                    </motion.span>
                  )}
                </motion.button>
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
              <PulseScore score={venue.pulseScore} size="sm" showLabel={false} contextualLabel={getContextualEnergyLabel(venue)} />
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

      <ParallaxVenueHero
        venue={venue}
        pulseScore={venue.pulseScore}
        category={venue.category}
      />

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

        {/* Phase 2: Live Crowd Indicator */}
        <LiveCrowdIndicator
          count={presenceData?.friendsHereNowCount ?? Math.floor(venue.pulseScore * 1.5)}
          trend={venue.pulseScore >= 70 ? 'rising' : venue.pulseScore >= 40 ? 'steady' : 'falling'}
          friendCount={presenceData?.friendsNearbyCount ?? 0}
        />

        {/* Phase 4: Venue Memory Card */}
        {currentUser && (
          <VenueMemoryCard
            venue={venue}
            user={currentUser}
            pulses={venuePulses}
          />
        )}

        {presenceData && (
          <WhoIsHereRow
            presence={presenceData}
            onClick={onOpenPresence}
          />
        )}

        {/* Phase 2: Energy Timeline */}
        <VenueEnergyTimeline venue={venue} />

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

        {/* Ticketing & Table Reservations */}
        {(onGetTickets || onReserveTable) && (
          <div className="flex gap-2">
            {onGetTickets && (
              <button
                onClick={onGetTickets}
                className="flex-1 flex items-center gap-2 p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 hover:border-primary/40 transition-colors"
              >
                <Ticket size={18} weight="fill" className="text-primary" />
                <span className="text-sm font-medium">Get Tickets</span>
              </button>
            )}
            {onReserveTable && (
              <button
                onClick={onReserveTable}
                className="flex-1 flex items-center gap-2 p-3 bg-gradient-to-r from-blue-500/10 to-blue-500/5 rounded-lg border border-blue-500/20 hover:border-blue-500/40 transition-colors"
              >
                <CalendarBlank size={18} weight="fill" className="text-blue-500" />
                <span className="text-sm font-medium">Reserve Table</span>
              </button>
            )}
          </div>
        )}

        {/* Quick Actions: Rideshare & Reservations */}
        {onOpenIntegrations && (
          <div className="flex gap-2">
            <button
              onClick={onOpenIntegrations}
              className="flex-1 flex items-center gap-2 p-3 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors"
            >
              <Car size={18} weight="fill" className="text-primary" />
              <span className="text-sm font-medium">Get a Ride</span>
            </button>
            <button
              onClick={onOpenIntegrations}
              className="flex-1 flex items-center gap-2 p-3 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors"
            >
              <CalendarCheck size={18} weight="fill" className="text-blue-500" />
              <span className="text-sm font-medium">Reserve</span>
            </button>
          </div>
        )}

        {/* Live Venue Intelligence Panel */}
        {liveData && (
          <VenueLivePanel
            liveData={liveData}
            onReport={() => setReportSheetOpen(true)}
            onRefresh={refreshLiveData}
          />
        )}

        {/* Phase 2: Quick Actions Bar */}
        <VenueQuickActions
          venue={venue}
          onCheckIn={onCreatePulse}
          onShare={handleShare}
          onDirections={() => {
            if (venue.location.address) {
              window.open(`https://maps.google.com/?q=${encodeURIComponent(venue.location.address)}`, '_blank')
            }
          }}
          onSave={onToggleFavorite}
          isSaved={isFavorite}
        />

        <ScoreBreakdown venue={venue} pulses={venuePulses.map(p => ({ ...p }))} />

        {/* Phase 2: Activity Stream */}
        <VenueActivityStream
          venueId={venue.id}
          venueName={venue.name}
        />

        <Separator />

        {venuePulses.length === 0 ? (
          <AnimatedEmptyState
            variant="no-pulses"
            onAction={onCreatePulse}
            actionLabel="Create Pulse"
          />
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

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        card={shareCard}
      />

      <QuickReportSheet
        open={reportSheetOpen}
        onClose={() => setReportSheetOpen(false)}
        venueName={venue.name}
        onSubmitWaitTime={(minutes) => {
          if (currentUser) reportWaitTime(venue.id, currentUser.id, minutes)
          refreshLiveData()
        }}
        onSubmitCoverCharge={(amount, note) => {
          if (currentUser) reportCoverCharge(venue.id, currentUser.id, amount, note)
          refreshLiveData()
        }}
        onSubmitMusicGenre={(genre) => {
          if (currentUser) reportMusicPlaying(venue.id, currentUser.id, genre)
          refreshLiveData()
        }}
        onSubmitCrowdLevel={(level) => {
          if (currentUser) reportCrowdLevel(venue.id, currentUser.id, level)
          refreshLiveData()
        }}
        onSubmitDressCode={(code) => {
          if (currentUser) reportDressCode(venue.id, currentUser.id, code)
          refreshLiveData()
        }}
        onSubmitNowPlaying={(track, artist) => {
          if (currentUser) reportNowPlaying(venue.id, currentUser.id, track, artist)
          refreshLiveData()
        }}
      />
    </div>
  )
}
