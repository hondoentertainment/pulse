import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Venue, PulseWithUser, User, PresenceData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { PulseCard } from '@/components/PulseCard'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { ShareSheet } from '@/components/ShareSheet'
import { VenueLivePanel } from '@/components/VenueLivePanel'
import { QuickReportSheet } from '@/components/QuickReportSheet'
import { VenueActionPanel } from '@/components/VenueActionPanel'
import { MapPin, ArrowLeft, Clock, Star, Phone, Globe, HeartStraight, CalendarCheck, ShareNetwork } from '@phosphor-icons/react'
import { formatDistance } from '@/lib/units'
import { formatTimeAgo, getEnergyLabel } from '@/lib/pulse-engine'
import { generateVenueShareCard, getVenueDeepLink, type ShareCard } from '@/lib/sharing'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { AnimatedEmptyState } from './AnimatedEmptyState'
import { WhoIsHereRow } from './WhoIsHereRow'
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
import { track } from '@/lib/observability/analytics'
import { funnelActor, trackFunnel } from '@/lib/funnel-events'
import { LiveNowStrip } from '@/components/LiveNowStrip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { energyScoreColor, getLiveNowReviews, venueStatusLine } from '@/lib/live-reviews'
import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import { authorHandle, venueHandle } from '@/lib/venue-handle'
import { UX_CARD, UX_CTA_INVERT } from '@/lib/ux-chrome'
import { FollowVenueButton } from '@/components/FollowVenueButton'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { getWriteAuthRedirect, WRITE_AUTH_COPY } from '@/lib/guest-discovery'
import { ShareArrivalCard } from '@/components/ShareArrivalCard'
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
import { hasSupabaseConfig } from '@/lib/supabase'
import { fetchVenueLiveReportsFromSupabase, submitVenueLiveReportToSupabase } from '@/lib/supabase-api'
import { queryClient } from '@/lib/query-client'
import { computeVenueSignal } from '@/lib/venue-signal'
import { buildWorthGoingSummary } from '@/lib/worth-going'
import { WorthGoingSummary } from '@/components/WorthGoingSummary'
import { ArrivalPrompt } from '@/components/ArrivalPrompt'
import {
  confirmArrival,
  getArrivalWatchStatus,
  reportArrivalMismatch,
  startArrivalWatch,
  type ArrivalWatch,
} from '@/lib/arrival-prompt'

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
  /** Wave 4 — paginated venue pulses from server */
  onLoadMoreVenuePulses?: () => void
  hasMoreVenuePulses?: boolean
  isLoadingMoreVenuePulses?: boolean
}

export function VenuePage({
  venue,
  venuePulses,
  distance,
  userLocation,
  unitSystem,
  locationName,
  isTracking: _isTracking,
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
  onLoadMoreVenuePulses,
  hasMoreVenuePulses,
  isLoadingMoreVenuePulses,
}: VenuePageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromShare = searchParams.get('from') === 'share'
  const { session, isPlaceholder } = useSupabaseAuth()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCard, setShareCard] = useState<ShareCard | null>(null)
  const [reportSheetOpen, setReportSheetOpen] = useState(false)
  const [selectedLiveReview, setSelectedLiveReview] = useState<PulseWithUser | null>(null)
  const [liveData, setLiveData] = useState<VenueLiveData | null>(null)
  const [isWatchingSurge, setIsWatchingSurge] = useState(false)
  const [arrivalWatch, setArrivalWatch] = useState<ArrivalWatch | null>(null)
  const [arrivalTick, setArrivalTick] = useState(0)
  const liveReportsQueryKey = ['venue-live-reports', venue.id]

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

  useEffect(() => {
    if (!arrivalWatch) return
    const timer = window.setInterval(() => setArrivalTick((tick) => tick + 1), 15_000)
    return () => window.clearInterval(timer)
  }, [arrivalWatch])

  const venueSignal = useMemo(
    () => computeVenueSignal({
      venue,
      pulses: venuePulses,
      liveReports: Array.isArray(serverLiveReports) ? serverLiveReports : [],
      liveData,
    }),
    [liveData, serverLiveReports, venue, venuePulses],
  )
  const worthGoing = useMemo(() => buildWorthGoingSummary(venueSignal, venue), [venue, venueSignal])
  const showArrivalPrompt = Boolean(
    arrivalWatch &&
    arrivalTick >= 0 &&
    getArrivalWatchStatus(arrivalWatch) === 'ready',
  )

  useEffect(() => {
    if (!showArrivalPrompt || !arrivalWatch) return
    trackEvent({ type: 'arrival_prompt_shown', timestamp: Date.now(), venueId: arrivalWatch.venueId })
  }, [arrivalWatch, showArrivalPrompt])

  useEffect(() => {
    track('venue_viewed', { venueId: venue.id, source: fromShare ? 'share' : 'deeplink' })
    trackFunnel('venue_open', {
      venueId: venue.id,
      guest: funnelActor({ hasSession: Boolean(session), isPlaceholder }).guest,
      fromShare,
    })
  }, [fromShare, isPlaceholder, session, venue.id])

  const liveNowReviews = useMemo(
    () => getLiveNowReviews(venuePulses, venue.id),
    [venue.id, venuePulses],
  )
  const historyPulses = useMemo(() => {
    const liveIds = new Set(liveNowReviews.map((pulse) => pulse.id))
    return venuePulses.filter((pulse) => !liveIds.has(pulse.id))
  }, [liveNowReviews, venuePulses])

  const handleShare = () => {
    const card = generateVenueShareCard(venue)
    setShareCard(card)
    setShareOpen(true)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getVenueDeepLink(venue.id))
      toast.success('Venue link copied')
    } catch {
      toast.error('Could not copy link')
    }
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
    const authRedirect = getWriteAuthRedirect({
      isPlaceholder,
      hasSession: Boolean(session),
    })
    if (authRedirect || !currentUser) {
      toast.error(WRITE_AUTH_COPY.intel.title, { description: WRITE_AUTH_COPY.intel.description })
      navigate(authRedirect ?? '/auth')
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-2xl space-y-3 px-4 pb-6 pt-6"
      >
        <div>
          <button
            onClick={onBack}
            aria-label="Back to Map"
            className="mb-3 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
            Map
          </button>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">{venue.name}</h1>
          <p className="sr-only">{venueHandle(venue.name)}</p>
          {(() => {
            const placeStatus = venueStatusLine(venue)
            const verified = Boolean(
              venue.claimVerified ||
              venue.verifiedCheckInCount ||
              venuePulses.some((pulse) => pulse.locationVerified),
            )
            const line = [
              placeStatus,
              venue.claimVerified ? 'Claimed' : verified ? 'Verified' : null,
            ].filter(Boolean).join(' · ')
            return line ? (
              <p className="mt-1 text-[13px] text-muted-foreground">{line}</p>
            ) : null
          })()}
        </div>
        {fromShare && (
          <ShareArrivalCard venue={venue} pulses={venuePulses} />
        )}
        {(() => {
          const recent10m = venuePulses.filter(p => Date.now() - new Date(p.createdAt).getTime() < 10 * 60 * 1000).length
          const delta = recent10m * 8
          return (
            <Card className={`${UX_CARD} p-3.5`}>
              <div className="flex items-center gap-3.5">
                <p
                  className="text-[40px] font-bold tabular-nums leading-none text-primary"
                  style={{ color: energyScoreColor(venue.pulseScore) }}
                >
                  {venue.pulseScore}
                </p>
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold text-foreground">{getEnergyLabel(venue.pulseScore)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                    {delta > 0 && <span>+{delta} / 10m ·</span>}
                    <ScoreBreakdown venue={venue} pulses={venuePulses.map(p => ({ ...p }))} inline />
                  </div>
                </div>
              </div>
            </Card>
          )
        })()}

        <div className="flex gap-2">
          <Button
            onClick={onCreatePulse}
            className={`${UX_CTA_INVERT} flex-1`}
          >
            I’m here · Pulse
          </Button>
          {onToggleFollow && (
            <FollowVenueButton
              following={Boolean(isFollowed)}
              onClick={onToggleFollow}
            />
          )}
        </div>

        <LiveNowStrip
          venueId={venue.id}
          pulses={venuePulses}
          venueName={venue.name}
          onSelect={setSelectedLiveReview}
        />

        <details className="rounded-xl border border-border bg-card p-3.5">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
            More venue details
          </summary>
          <div className="mt-4 space-y-6">
            {venue.pulseScore >= 25 && getContextualLabel(venue) && (
              <p className="text-sm font-medium italic text-accent">{getContextualLabel(venue)}</p>
            )}
            {distance !== undefined && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin size={14} weight="fill" />
                {formatDistance(distance, unitSystem)} away
              </p>
            )}
            {locationName && (
              <p className="text-xs text-muted-foreground">
                {locationName}
                {hasRealtimeLocation ? ' · LIVE' : ''}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {onToggleFollow && (
                <button
                  onClick={onToggleFollow}
                  aria-label={isFollowed ? 'Unfollow venue' : 'Follow venue'}
                  className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-secondary"
                >
                  <HeartStraight
                    size={24}
                    weight={isFollowed ? 'fill' : 'regular'}
                    className={isFollowed ? 'text-primary' : 'text-muted-foreground'}
                  />
                </button>
              )}
              <button
                onClick={handleShare}
                aria-label="Share venue"
                className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-secondary"
              >
                <ShareNetwork size={24} className="text-muted-foreground" />
              </button>
              <button
                onClick={() => { void handleCopyLink() }}
                aria-label="Copy venue link"
                className="min-h-11 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Copy link
              </button>
              <button
                onClick={onToggleFavorite}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-secondary"
              >
                <Star
                  size={24}
                  weight={isFavorite ? 'fill' : 'regular'}
                  className={isFavorite ? 'text-accent' : 'text-muted-foreground'}
                />
              </button>
            </div>
        <WorthGoingSummary summary={worthGoing} />

        {showArrivalPrompt && arrivalWatch && (
          <ArrivalPrompt
            watch={arrivalWatch}
            onConfirm={() => {
              const next = confirmArrival(arrivalWatch.id)
              setArrivalWatch(next)
              trackEvent({ type: 'arrival_confirmed', timestamp: Date.now(), venueId: venue.id })
              toast.success('Thanks — signal confirmed')
            }}
            onMismatch={(correction) => {
              const next = reportArrivalMismatch(arrivalWatch.id, correction)
              setArrivalWatch(next)
              trackEvent({
                type: 'mismatch_reported',
                timestamp: Date.now(),
                venueId: venue.id,
                correction,
              })
              toast.success('Mismatch recorded')
            }}
          />
        )}

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

        {venue.lastPulseAt && (
          <p className="text-sm text-muted-foreground">
            Last pulse {formatTimeAgo(venue.lastPulseAt)}
          </p>
        )}

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

        {isFeatureEnabled('venueInbox') && (
          <Button
            variant="outline"
            onClick={() => navigate(`/venue/${venue.id}/inbox`)}
            className="w-full"
          >
            Venue inbox
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
          onDirections={() => {
            const watch = startArrivalWatch(venue.id, venue.name)
            setArrivalWatch(watch)
            if (directionsAction) launchVenueAction(directionsAction)
          }}
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

        {/* Phase 2: Activity Stream */}
        <VenueActivityStream
          venueId={venue.id}
          venueName={venue.name}
        />

        <Separator />

        <h2 className="text-[15px] font-bold">History</h2>

        {venuePulses.length === 0 ? (
          <AnimatedEmptyState
            variant="no-pulses"
            onAction={onCreatePulse}
            actionLabel="Post live review"
          />
        ) : historyPulses.length === 0 ? (
          <p className="border-y border-border py-5 text-[15px] text-muted-foreground">Older reviews will appear here after they leave the live window.</p>
        ) : (
          <div>
            {historyPulses.map((pulse) => (
              <LiveReviewFeedCard
                key={pulse.id}
                as="button"
                energyRating={pulse.energyRating}
                createdAt={pulse.createdAt}
                caption={pulse.caption}
                unverified={pulse.locationVerified === false}
                displayName={pulse.user?.username || venue.name}
                handle={authorHandle(pulse.user?.username, venue.name)}
                avatarUrl={pulse.user?.profilePhoto}
                onClick={() => setSelectedLiveReview(pulse)}
                onBoost={() => onReaction(pulse.id, 'lightning')}
              />
            ))}
            {onLoadMoreVenuePulses && hasMoreVenuePulses ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={isLoadingMoreVenuePulses}
                onClick={onLoadMoreVenuePulses}
              >
                {isLoadingMoreVenuePulses ? 'Loading…' : 'Load more pulses'}
              </Button>
            ) : null}
          </div>
        )}
          </div>
        </details>
      </motion.div>

      <Dialog open={Boolean(selectedLiveReview)} onOpenChange={(open) => { if (!open) setSelectedLiveReview(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Live review</DialogTitle>
            <DialogDescription>
              Full on-site review at {venue.name}
            </DialogDescription>
          </DialogHeader>
          {selectedLiveReview && (
            <PulseCard
              pulse={selectedLiveReview}
              allPulses={venuePulses}
              onReaction={(type) => onReaction(selectedLiveReview.id, type)}
              currentUserId={currentUser?.id}
              onReport={onReportPulse}
              venueName={venue.name}
            />
          )}
        </DialogContent>
      </Dialog>

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
