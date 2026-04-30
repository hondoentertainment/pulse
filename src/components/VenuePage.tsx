import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { VenueActionPanel } from '@/components/VenueActionPanel'
import { Plus, MapPin, ArrowLeft, Clock, Star, Phone, Globe, HeartStraight, CalendarCheck, ShareNetwork } from '@phosphor-icons/react'
import { formatDistance } from '@/lib/units'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { generateVenueShareCard, type ShareCard } from '@/lib/sharing'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { AnimatedEmptyState } from './AnimatedEmptyState'
import { WhoIsHereRow } from './WhoIsHereRow'
import { VenueDetailHero } from './VenueDetailHero'
import type { ContentReport } from '@/lib/content-moderation'
// Phase 2: Venue star moment
import { LiveCrowdIndicator } from './LiveCrowdIndicator'
import { VenueEnergyTimeline } from './VenueEnergyTimeline'
import { VenueQuickActions } from './VenueQuickActions'
import { VenueActivityStream } from './VenueActivityStream'
// Phase 4: Personalization
import VenueMemoryCard from './VenueMemoryCard'
import { getContextualLabel } from '@/lib/time-contextual-scoring'
import { trackEvent } from '@/lib/analytics'
import { getVenueActionCtas, type VenueActionCta } from '@/lib/venue-action-ctas'
import { launchIntegrationUrl } from '@/lib/integrations'
import { isVenueSurgeWatched, toggleVenueSurgeWatch } from '@/lib/venue-surge-watch'
import {
  addLocalLiveReport,
  createLiveReport,
  getVenueLiveData,
  getVenueLiveDataFromReports,
  seedDemoReports,
  type VenueLiveData,
  type LiveReport,
} from '@/lib/live-intelligence'
import { seedVenueOperatorStatus } from '@/lib/venue-operator-live'
import { useCurrentTime } from '@/hooks/use-current-time'
import { hasSupabaseConfig } from '@/lib/supabase'
import { fetchVenueLiveReportsFromSupabase, submitVenueLiveReportToSupabase } from '@/lib/supabase-api'
import { queryClient } from '@/lib/query-client'

interface VenuePageProps {
  venue: Venue
  venuePulses: PulseWithUser[]
  distance?: number
  userLocation?: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  locationName: string
  isTracking: boolean
  hasRealtimeLocation: boolean
  isFavorite: boolean
  isFollowed?: boolean
  currentUser?: User | null
  onBack: () => void
  onCreatePulse: () => void
  onStartCrewCheckIn?: () => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  onReportPulse?: (report: ContentReport) => void
  onToggleFavorite: () => void
  onToggleFollow?: () => void
  presenceData?: PresenceData | null
  onOpenPresence: () => void
  onOpenIntegrations?: () => void
}

export function VenuePage({
  venue,
  venuePulses,
  distance,
  userLocation,
  unitSystem,
  locationName,
  isTracking,
  hasRealtimeLocation,
  isFavorite,
  isFollowed,
  currentUser,
  onBack,
  onCreatePulse,
  onStartCrewCheckIn,
  onReaction,
  onReportPulse,
  onToggleFavorite,
  onToggleFollow,
  presenceData,
  onOpenPresence,
  onOpenIntegrations,
}: VenuePageProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCard, setShareCard] = useState<ShareCard | null>(null)
  const [reportSheetOpen, setReportSheetOpen] = useState(false)
  const [liveData, setLiveData] = useState<VenueLiveData | null>(null)
  const [isWatchingSurge, setIsWatchingSurge] = useState(false)
  const currentTime = useCurrentTime()
  const liveReportsQueryKey = ['venue-live-reports', venue.id]
  const heroMediaUrl = venuePulses.find(pulse => pulse.photos?.[0])?.photos?.[0]

  const { data: serverLiveReports, refetch: refetchLiveReports } = useQuery({
    queryKey: liveReportsQueryKey,
    queryFn: () => fetchVenueLiveReportsFromSupabase(venue.id),
    enabled: hasSupabaseConfig,
  })

  const refreshLiveData = useCallback(() => {
    if (hasSupabaseConfig && Array.isArray(serverLiveReports)) {
      setLiveData(getVenueLiveDataFromReports(venue.id, serverLiveReports))
      return
    }
    setLiveData(getVenueLiveData(venue.id))
  }, [serverLiveReports, venue.id])

  useEffect(() => {
    // Seed demo data on first load for this venue
    if (!hasSupabaseConfig) seedDemoReports([venue.id])
    seedVenueOperatorStatus(venue.id, venue.name)
    refreshLiveData()
  }, [venue.id, venue.name, refreshLiveData])

  useEffect(() => {
    refreshLiveData()
  }, [refreshLiveData])

  useEffect(() => {
    setIsWatchingSurge(isVenueSurgeWatched(venue.id))
  }, [venue.id])

  const handleShare = () => {
    const card = generateVenueShareCard(venue)
    setShareCard(card)
    setShareOpen(true)
  }

  const actionCtas = getVenueActionCtas(venue, {
    userLocation: userLocation ?? null,
    liveData,
    isWatchingSurge,
  })

  const directionsAction = actionCtas.find(action => action.id === 'directions')
  const rideAction = actionCtas.find(action => action.id === 'ride')
  const reserveAction = actionCtas.find(action => action.id === 'reserve')
  const ticketAction = actionCtas.find(action => action.id === 'tickets')

  const launchVenueAction = (action: VenueActionCta) => {
    if (action.kind === 'status') {
      toast.info(action.label, { description: action.description })
      return
    }

    if (action.kind === 'toggle') {
      const next = toggleVenueSurgeWatch(venue.id)
      setIsWatchingSurge(next)
      trackEvent({
        type: 'integration_action',
        timestamp: Date.now(),
        venueId: venue.id,
        integrationType: 'shortcuts',
        actionId: next ? 'enable_surge_watch' : 'disable_surge_watch',
        outcome: 'success',
      })
      toast.success(next ? 'Watching for surges' : 'Surge alerts removed', {
        description: next
          ? `Pulse will keep ${venue.name} on your radar when energy spikes.`
          : `You will no longer be nudged when ${venue.name} surges.`,
      })
      return
    }

    if (action.disabledReason || !action.href || !action.integrationType) {
      trackEvent({
        type: 'integration_action',
        timestamp: Date.now(),
        venueId: venue.id,
        integrationType: action.integrationType ?? 'shortcuts',
        actionId: action.id,
        provider: action.provider,
        outcome: 'unavailable',
        reason: action.disabledReason ?? 'missing-link',
      })
      toast.error(action.disabledReason ?? 'This action is not available yet.')
      return
    }

    const result = launchIntegrationUrl(action.href, {
      opener: (...args) => window.open(...args),
      locationAssign: nextUrl => window.location.assign(nextUrl),
    })

    trackEvent({
      type: 'integration_action',
      timestamp: Date.now(),
      venueId: venue.id,
      integrationType: action.integrationType,
      actionId: action.id,
      provider: action.provider,
      outcome: result.ok ? 'success' : result.reason === 'unavailable' ? 'unavailable' : 'failed',
      reason: result.reason,
    })

    if (!result.ok) {
      toast.error('Unable to open link', {
        description: action.disabledReason ?? 'Check browser settings and try again.',
      })
      return
    }

    toast.success(action.label, {
      description: action.description,
    })
  }

  const submitLiveReport = async (type: LiveReport['type'], value: unknown) => {
    if (!currentUser) {
      toast.error('Sign in to report live intel')
      return
    }

    const optimisticReport = createLiveReport(venue.id, currentUser.id, type, value)
    const currentReports = Array.isArray(serverLiveReports) ? serverLiveReports : []
    setLiveData(getVenueLiveDataFromReports(venue.id, [optimisticReport, ...currentReports]))

    if (!hasSupabaseConfig) {
      addLocalLiveReport(optimisticReport)
      refreshLiveData()
      toast.success('Live intel added')
      return
    }

    const savedReport = await submitVenueLiveReportToSupabase(optimisticReport)
    if (!savedReport) {
      addLocalLiveReport(optimisticReport)
      refreshLiveData()
      toast.warning('Saved locally', { description: 'Live intel will appear on this device.' })
      return
    }

    queryClient.setQueryData<LiveReport[]>(liveReportsQueryKey, (old = []) => {
      if (old.some(report => report.id === savedReport.id)) return old
      return [savedReport, ...old]
    })
    setLiveData(getVenueLiveDataFromReports(venue.id, [savedReport, ...currentReports]))
    void refetchLiveReports()
    toast.success('Live intel shared')
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <VenueDetailHero
        venue={venue}
        mediaUrl={heroMediaUrl}
        isFavorite={isFavorite}
        isFollowed={isFollowed}
        onBack={onBack}
        onShare={handleShare}
        onToggleFavorite={onToggleFavorite}
        onToggleFollow={onToggleFollow}
      />

      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              aria-label="Back to venues"
              className="min-h-11 min-w-11 p-2 hover:bg-secondary rounded-lg transition-colors touch-manipulation active:scale-[0.98]"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{venue.name}</h1>
              {venue.pulseScore >= 25 && getContextualLabel(venue) && (
                <p className="text-sm text-accent font-medium italic mt-0.5">{getContextualLabel(venue)}</p>
              )}
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
                  aria-label={isFollowed ? "Unfollow venue" : "Follow venue"}
                  className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-secondary transition-colors touch-manipulation active:scale-[0.98]"
                  title={isFollowed ? "Unfollow" : "Follow"}
                >
                  <HeartStraight
                    size={24}
                    weight={isFollowed ? "fill" : "regular"}
                    className={isFollowed ? "text-primary" : "text-muted-foreground"}
                  />
                </button>
              )}
              <button
                onClick={handleShare}
                aria-label="Share venue"
                className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-secondary transition-colors touch-manipulation active:scale-[0.98]"
              >
                <ShareNetwork size={24} className="text-muted-foreground" />
              </button>
              <button
                onClick={onToggleFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-secondary transition-colors touch-manipulation active:scale-[0.98]"
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
              <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
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

        {/* Phase 2: Live Crowd Indicator */}
        <LiveCrowdIndicator
          count={presenceData?.friendsHereNowCount ?? Math.floor(venue.pulseScore * 1.5)}
          trend={venue.pulseScore >= 70 ? 'rising' : venue.pulseScore >= 40 ? 'steady' : 'falling'}
          friendCount={presenceData?.friendsNearbyCount ?? 0}
          isEstimated={!presenceData}
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
        <VenueEnergyTimeline
          venueId={venue.id}
          currentScore={venue.pulseScore}
        />

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

        {onStartCrewCheckIn && (
          <Button
            variant="outline"
            onClick={onStartCrewCheckIn}
            className="w-full border-primary/30 text-primary hover:bg-primary/10"
          >
            <CalendarCheck size={18} weight="bold" className="mr-2" />
            Check In With Crew
          </Button>
        )}

        <VenueActionPanel actions={actionCtas} onAction={launchVenueAction} />

        {onOpenIntegrations && (
          <Button
            variant="outline"
            onClick={onOpenIntegrations}
            className="w-full border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
          >
            More Partner Links
          </Button>
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
          onCheckIn={onCreatePulse}
          onShare={handleShare}
          onDirections={() => directionsAction && launchVenueAction(directionsAction)}
          onRide={() => rideAction && launchVenueAction(rideAction)}
          onReserve={() => {
            if (reserveAction) {
              launchVenueAction(reserveAction)
              return
            }
            if (ticketAction) {
              launchVenueAction(ticketAction)
            }
          }}
          onWatchSurge={() => {
            const watchAction = actionCtas.find(action => action.id === 'surge_watch')
            if (watchAction) launchVenueAction(watchAction)
          }}
          onSave={onToggleFavorite}
          isSaved={isFavorite}
          isWatchingSurge={isWatchingSurge}
          canReserve={Boolean(reserveAction || ticketAction)}
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
                onReport={onReportPulse}
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
          void submitLiveReport('wait_time', minutes)
        }}
        onSubmitCoverCharge={(amount, note) => {
          void submitLiveReport('cover_charge', { amount, note })
        }}
        onSubmitMusicGenre={(genre) => {
          void submitLiveReport('music', genre)
        }}
        onSubmitCrowdLevel={(level) => {
          void submitLiveReport('crowd_level', level)
        }}
        onSubmitDressCode={(code) => {
          void submitLiveReport('dress_code', code)
        }}
        onSubmitNowPlaying={(track, artist) => {
          void submitLiveReport('now_playing', { track, artist })
        }}
      />
    </div>
  )
}
