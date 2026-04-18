import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Venue, PulseWithUser, User, PresenceData } from '@/lib/types'
import { track } from '@/lib/observability/analytics'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { PulseScore } from '@/components/PulseScore'
import { PulseCard } from '@/components/PulseCard'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { ShareSheet } from '@/components/ShareSheet'
import { VenueLivePanel } from '@/components/VenueLivePanel'
import { QuickReportSheet } from '@/components/QuickReportSheet'
import { Plus, MapPin, ArrowLeft, Clock, Star, Phone, Globe, HeartStraight, Car, CalendarCheck, ShareNetwork, Ticket, CalendarBlank, CurrencyDollar, Heart } from '@phosphor-icons/react'
import { ACCESSIBILITY_LABELS } from '@/components/filters/AccessibilityFilter'
import { formatDistance } from '@/lib/units'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { generateVenueShareCard, type ShareCard } from '@/lib/sharing'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { AnimatedEmptyState } from './AnimatedEmptyState'
import { WhoIsHereRow } from './WhoIsHereRow'
import { ParallaxVenueHero } from './ParallaxVenueHero'
import type { ContentReport } from '@/lib/content-moderation'
// Phase 2: Venue star moment
import { LiveCrowdIndicator } from './LiveCrowdIndicator'
import { VenueEnergyTimeline } from './VenueEnergyTimeline'
import { VenueQuickActions } from './VenueQuickActions'
// VenueActivityStream removed — was displaying fabricated activity
// Phase 4: Personalization
import VenueMemoryCard from './VenueMemoryCard'
import { getContextualLabel } from '@/lib/time-contextual-scoring'
import {
  getVenueLiveData,
  reportWaitTime,
  reportCoverCharge,
  reportMusicPlaying,
  reportCrowdLevel,
  reportDressCode,
  reportNowPlaying,
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
  onStartCrewCheckIn?: () => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  onReportPulse?: (report: ContentReport) => void
  onToggleFavorite: () => void
  onToggleFollow?: () => void
  presenceData?: PresenceData | null
  onOpenPresence: () => void
  onOpenIntegrations?: () => void
  onGetTickets?: () => void
  onReserveTable?: () => void
}

const DRESS_CODE_DISPLAY: Record<string, string> = {
  casual: 'Casual',
  smart_casual: 'Smart casual',
  upscale: 'Upscale',
  formal: 'Formal',
  costume_required: 'Costume required',
  no_code: 'No dress code',
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
  onStartCrewCheckIn,
  onReaction,
  onReportPulse,
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
  const routerLocation = useLocation()
  const hasCheckedInRef = useRef<boolean>(
    Boolean(currentUser?.venueCheckInHistory?.[venue.id]),
  )

  const refreshLiveData = useCallback(() => {
    setLiveData(getVenueLiveData(venue.id))
  }, [venue.id])

  useEffect(() => {
    refreshLiveData()
  }, [venue.id, refreshLiveData])

  // Fire `venue_viewed` once per venue mount; prefer source provided in
  // router state (e.g. `{ source: 'map' | 'trending' | 'search' }`) and fall
  // back to `'direct'` for deep links / direct navigation.
  useEffect(() => {
    const state = routerLocation.state as { source?: string } | null
    const source = state?.source ?? 'direct'
    track('venue_viewed', { venueId: venue.id, source })
  }, [venue.id, routerLocation.state])

  const handleCreatePulseWithTracking = useCallback(() => {
    const priorCheckIns = currentUser?.venueCheckInHistory?.[venue.id] ?? 0
    const isFirstCheckIn = !hasCheckedInRef.current && priorCheckIns === 0
    track('check_in_completed', {
      venueId: venue.id,
      method: 'manual',
      isFirstCheckIn,
    })
    hasCheckedInRef.current = true
    onCreatePulse()
  }, [currentUser, venue.id, onCreatePulse])

  const handleShare = () => {
    const card = generateVenueShareCard(venue)
    setShareCard(card)
    setShareOpen(true)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold">{venue.name}</h1>
              {venue.pulseScore >= 25 && getContextualLabel(venue) && (
                <p className="text-sm text-[#E1306C] font-medium italic mt-0.5">{getContextualLabel(venue)}</p>
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
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                  title={isFollowed ? "Unfollow" : "Follow"}
                >
                  <HeartStraight
                    size={24}
                    weight={isFollowed ? "fill" : "regular"}
                    className={isFollowed ? "text-[#E1306C]" : "text-muted-foreground"}
                  />
                </button>
              )}
              <button
                onClick={handleShare}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <ShareNetwork size={24} className="text-muted-foreground" />
              </button>
              {onToggleFollow && (
                <button
                  onClick={onToggleFollow}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <HeartStraight
                    size={24}
                    weight={isFollowed ? 'fill' : 'regular'}
                    className={isFollowed ? 'text-[#E1306C]' : 'text-muted-foreground'}
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
                  className={isFavorite ? 'text-[#FCAF45]' : 'text-muted-foreground'}
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
                  isTracking ? "text-[#E1306C] animate-pulse" : "text-muted-foreground"
                )} />
                <span>{locationName}</span>
                {hasRealtimeLocation && (
                  <span className="text-[10px] bg-[#E1306C]/20 text-[#E1306C] px-1.5 py-0.5 rounded-md uppercase font-bold">
                    LIVE
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock size={12} weight="fill" className="text-[#E1306C]" />
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
            <Card className="p-4 space-y-4 bg-card/95 backdrop-blur-xl border-white/10 rounded-2xl shadow-lg">
              <h3 className="text-lg font-semibold">Venue Details</h3>

              {venue.location.address && (
                <div className="flex items-start gap-3">
                  <MapPin size={20} weight="fill" className="text-[#E1306C] mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p className="text-sm">{venue.location.address}</p>
                  </div>
                </div>
              )}

              {venue.phone && (
                <div className="flex items-start gap-3">
                  <Phone size={20} weight="fill" className="text-[#E1306C] mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <a
                      href={`tel:${venue.phone}`}
                      className="text-sm text-[#405DE6] hover:underline"
                    >
                      {venue.phone}
                    </a>
                  </div>
                </div>
              )}

              {venue.website && (
                <div className="flex items-start gap-3">
                  <Globe size={20} weight="fill" className="text-[#E1306C] mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Website</p>
                    <a
                      href={venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#405DE6] hover:underline"
                    >
                      {venue.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
              )}

              {venue.hours && (
                <div className="flex items-start gap-3">
                  <Clock size={20} weight="fill" className="text-[#E1306C] mt-0.5 flex-shrink-0" />
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
                              isToday && "font-semibold text-[#E1306C]"
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

        {(venue.dressCode ||
          typeof venue.coverChargeCents === 'number' ||
          venue.coverChargeNote ||
          (venue.accessibilityFeatures && venue.accessibilityFeatures.length > 0)) && (
          <Card className="p-4 space-y-4 bg-card/95 backdrop-blur-xl border-white/10 rounded-2xl shadow-lg">
            <h3 className="text-lg font-semibold">Details</h3>
            {venue.dressCode && (
              <div className="flex items-start gap-3">
                <Star size={20} weight="fill" className="text-[#833AB4] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Dress code</p>
                  <p className="text-sm">{DRESS_CODE_DISPLAY[venue.dressCode] ?? venue.dressCode}</p>
                </div>
              </div>
            )}
            {(typeof venue.coverChargeCents === 'number' || venue.coverChargeNote) && (
              <div className="flex items-start gap-3">
                <CurrencyDollar size={20} weight="fill" className="text-[#FCAF45] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Cover</p>
                  <p className="text-sm">
                    {typeof venue.coverChargeCents === 'number'
                      ? venue.coverChargeCents === 0
                        ? 'No cover'
                        : `$${(venue.coverChargeCents / 100).toFixed(2)}`
                      : null}
                    {venue.coverChargeNote ? (
                      <span className="text-muted-foreground">
                        {typeof venue.coverChargeCents === 'number' ? ' · ' : ''}
                        {venue.coverChargeNote}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            )}
            {venue.accessibilityFeatures && venue.accessibilityFeatures.length > 0 && (
              <div className="flex items-start gap-3">
                <Heart size={20} weight="fill" className="text-[#E1306C] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Accessibility</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {venue.accessibilityFeatures.map((f) => (
                      <li
                        key={f}
                        className="text-xs px-2 py-0.5 rounded-full border border-[#E1306C]/40 text-foreground"
                      >
                        {ACCESSIBILITY_LABELS[f] ?? f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Phase 2: Live Crowd Indicator — only show with real presence data */}
        {(presenceData?.friendsHereNowCount ?? venue.verifiedCheckInCount ?? 0) > 0 && (
          <LiveCrowdIndicator
            count={presenceData?.friendsHereNowCount ?? venue.verifiedCheckInCount ?? 0}
            trend={venue.pulseScore >= 70 ? 'rising' : venue.pulseScore >= 40 ? 'steady' : 'falling'}
            friendCount={presenceData?.friendsNearbyCount ?? 0}
          />
        )}

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
            <h2 className="text-lg font-semibold">Live Energy</h2>
            {venue.lastPulseAt && (
              <p className="text-sm text-muted-foreground">
                Last pulse {formatTimeAgo(venue.lastPulseAt)}
              </p>
            )}
          </div>
          <Button
            onClick={handleCreatePulseWithTracking}
            className="bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-90 text-white"
          >
            <Plus size={20} weight="bold" className="mr-2" />
            Create Pulse
          </Button>
        </div>

        {onStartCrewCheckIn && (
          <Button
            variant="outline"
            onClick={onStartCrewCheckIn}
            className="w-full border-[#833AB4]/30 text-[#833AB4] hover:bg-[#833AB4]/10"
          >
            <CalendarCheck size={18} weight="bold" className="mr-2" />
            Check In With Crew
          </Button>
        )}

        {/* Ticketing & Table Reservations */}
        {(onGetTickets || onReserveTable) && (
          <div className="flex gap-2">
            {onGetTickets && (
              <button
                onClick={onGetTickets}
                className="flex-1 flex items-center gap-2 p-3 bg-gradient-to-r from-[#E1306C]/10 to-[#E1306C]/5 rounded-2xl border border-white/10 hover:border-[#E1306C]/40 transition-colors backdrop-blur-xl"
              >
                <Ticket size={18} weight="fill" className="text-[#E1306C]" />
                <span className="text-sm font-medium">Get Tickets</span>
              </button>
            )}
            {onReserveTable && (
              <button
                onClick={onReserveTable}
                className="flex-1 flex items-center gap-2 p-3 bg-gradient-to-r from-[#405DE6]/10 to-[#405DE6]/5 rounded-2xl border border-white/10 hover:border-[#405DE6]/40 transition-colors backdrop-blur-xl"
              >
                <CalendarBlank size={18} weight="fill" className="text-[#405DE6]" />
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
              className="flex-1 flex items-center gap-2 p-3 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-[#833AB4]/30 transition-colors"
            >
              <Car size={18} weight="fill" className="text-[#833AB4]" />
              <span className="text-sm font-medium">Get a Ride</span>
            </button>
            <button
              onClick={onOpenIntegrations}
              className="flex-1 flex items-center gap-2 p-3 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-[#405DE6]/30 transition-colors"
            >
              <CalendarCheck size={18} weight="fill" className="text-[#405DE6]" />
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
          onCheckIn={handleCreatePulseWithTracking}
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

        {/* Activity stream removed — was displaying fabricated check-ins and arrivals */}

        <Separator />

        {venuePulses.length === 0 ? (
          <AnimatedEmptyState
            variant="no-pulses"
            onAction={handleCreatePulseWithTracking}
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
