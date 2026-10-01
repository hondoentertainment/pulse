import { useMemo, useState } from 'react'
import type { Pulse, Venue } from '@/lib/types'
import {
  buildTonightHome,
  listTonightFollowingFeed,
  listTonightNearVenues,
  TONIGHT_FOLLOWING_GUEST_EMPTY,
  TONIGHT_FOLLOWING_SIGNED_IN_EMPTY,
} from '@/lib/tonight-home'
import { TonightEmptyState } from '@/components/TonightEmptyState'
import { FeedTabBar } from '@/components/ux/FeedTabBar'
import { TrustPinChips } from '@/components/TrustPinChips'
import { VenueTypeahead } from '@/components/VenueTypeahead'
import { FollowVenueButton } from '@/components/FollowVenueButton'
import { getVenueMapActivity } from '@/lib/map-live-reviews'
import { getEnergyLabel } from '@/lib/pulse-engine'
import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { SignalPill } from '@/components/ux/SignalPill'
import { toneForEnergy } from '@/lib/signal-tone'
import { isOpenNow } from '@/lib/open-now'
import type { VenueMapActivity } from '@/lib/map-live-reviews'
import { buildTrustGlance } from '@/lib/trust-glance'
import { venueHandle } from '@/lib/venue-handle'
import { catalogQualityLine } from '@/lib/catalog-quality'
import { shareVenueFromSurface } from '@/lib/sharing'
import { toast } from 'sonner'
import type { MapHomeSurface } from '@/lib/ux-chrome'
import { orderFollowingRowsPinnedFirst } from '@/lib/my-night'
import { listFollowedPeoplePulses, mixFollowingFeed } from '@/lib/friends-follow'
import { DoorChipRow } from '@/components/DoorChipRow'
import { listEventsTonight, EVENTS_TONIGHT_EMPTY, EVENTS_TONIGHT_EMPTY_BODY, type CatalogEvent } from '@/lib/events-tonight'
import { listNeighborhoodPages, neighborhoodPath } from '@/lib/neighborhood-pages'
import { focusHoodDensityLabel } from '@/lib/focus-hood'
import { Link } from 'react-router-dom'
import { EmptySurgingStartHere } from '@/components/EmptySurgingStartHere'
import { InstallAffordance } from '@/components/InstallAffordance'
import { LastNightRecap } from '@/components/LastNightRecap'
import { AddToCalendarButton } from '@/components/AddToCalendarButton'
import { PulseThreadActions } from '@/components/PulseThreadActions'
import { OpenNowChip } from '@/components/OpenNowChip'
import { doorRollupLabel } from '@/lib/door-rollup'
import type { PulseReply } from '@/lib/pulse-thread'
import type { PulseAgree } from '@/lib/pulse-same'
import type { LastNightRoom } from '@/lib/last-night'

const MAP_TABS = [
  { id: 'tonight' as const, label: 'Tonight' },
  { id: 'live' as const, label: 'Live' },
  { id: 'map' as const, label: 'Map' },
]

type TonightFeed = 'foryou' | 'surging' | 'near' | 'open' | 'following'

const TONIGHT_FEEDS: readonly { id: TonightFeed; label: string; tone: 'cyan' | 'electric' | 'chill' | 'amber' | 'dead' }[] = [
  { id: 'foryou', label: 'For you', tone: 'cyan' },
  { id: 'surging', label: 'Surging', tone: 'electric' },
  { id: 'near', label: 'Near me', tone: 'chill' },
  { id: 'open', label: 'Open now', tone: 'amber' },
  { id: 'following', label: 'Following', tone: 'dead' },
]

interface TonightHomeHeaderProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  savedVenueIds?: readonly string[]
  followedVenueIds?: readonly string[]
  pinnedVenueIds?: readonly string[]
  followedUserIds?: readonly string[]
  catalogEvents?: readonly CatalogEvent[]
  recentVenues?: Venue[]
  signedIn?: boolean
  onHidePulse?: (pulseId: string) => void
  onPinMyNight?: (venueId: string) => void
  onBeFirstPulse?: (venue: Venue) => void
  locationDenied?: boolean
  onVenueClick: (venue: Venue) => void
  onFollowAuth?: () => void
  onToggleFollow?: (venueId: string) => void
  onShareVenue?: (venue: Venue) => void
  surface?: MapHomeSurface
  onSurfaceChange?: (surface: MapHomeSurface) => void
  viewerId?: string | null
  replies?: readonly PulseReply[]
  agrees?: readonly PulseAgree[]
  lastNightRooms?: LastNightRoom[]
  onLastNightAuth?: () => void
  onPulseReply?: (pulseId: string, venueId: string) => void
  onSameAgree?: (pulseId: string, venueId: string) => void
  onBlockUser?: (userId: string, venueId?: string) => void
}

export function TonightHomeHeader({
  venues,
  pulses,
  userLocation,
  savedVenueIds = [],
  followedVenueIds = [],
  pinnedVenueIds = [],
  followedUserIds = [],
  catalogEvents = [],
  recentVenues = [],
  signedIn = false,
  onHidePulse,
  onPinMyNight,
  onBeFirstPulse,
  locationDenied,
  onVenueClick,
  onFollowAuth,
  onToggleFollow,
  onShareVenue,
  surface = 'map',
  onSurfaceChange,
  viewerId,
  replies = [],
  agrees = [],
  lastNightRooms = [],
  onLastNightAuth,
  onPulseReply,
  onSameAgree,
  onBlockUser,
}: TonightHomeHeaderProps) {
  const [tonightFeed, setTonightFeed] = useState<TonightFeed>('foryou')
  const home = buildTonightHome({
    venues,
    pulses,
    userLocation,
    savedVenueIds,
    followedVenueIds,
    locationDenied,
  })

  const followingFeed = useMemo(() => {
    const venueRows = orderFollowingRowsPinnedFirst(
      listTonightFollowingFeed(venues, pulses, followedVenueIds),
      pinnedVenueIds,
    )
    return mixFollowingFeed(
      venueRows,
      listFollowedPeoplePulses(pulses, venues, followedUserIds),
    )
  }, [followedUserIds, followedVenueIds, pinnedVenueIds, pulses, venues])

  const tonightEvents = useMemo(() => listEventsTonight(catalogEvents), [catalogEvents])
  const hoodLinks = useMemo(() => listNeighborhoodPages(venues), [venues])

  const near = useMemo(
    () => listTonightNearVenues(venues, userLocation),
    [userLocation, venues],
  )

  return (
    <section aria-labelledby="tonight-home-heading" className="shrink-0">
      {onSurfaceChange && (
        <FeedTabBar
          tabs={MAP_TABS}
          value={surface}
          onChange={onSurfaceChange}
          ariaLabel="Map home views"
        />
      )}

      <header className={surface === 'map' ? 'space-y-1 pt-1' : 'space-y-1 pt-3'}>
        <h1
          id="tonight-home-heading"
          className={
            surface === 'map'
              ? 'text-[22px] font-bold leading-[29px] tracking-tight text-foreground'
              : 'text-[28px] font-bold leading-9 tracking-tight text-foreground'
          }
        >
          {surface === 'live' ? 'Live' : surface === 'map' ? 'Pulse' : 'Tonight'}
        </h1>
        {surface === 'tonight' && (
          <p className="text-[13px] text-muted-foreground">{home.subtitle} · habit ranking on</p>
        )}
        {surface === 'tonight' && focusHoodDensityLabel(home.neighborhood) && (
          <p className="text-[12px] font-semibold text-foreground">
            {focusHoodDensityLabel(home.neighborhood)}
          </p>
        )}
      </header>

      {surface !== 'live' && recentVenues.length > 0 && (
        <div className="pt-2 pb-1">
          <p className="text-[13px] font-semibold text-muted-foreground">Recent</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recentVenues.map((venue) => (
              <button
                key={venue.id}
                type="button"
                onClick={() => onVenueClick(venue)}
                className="h-8 rounded-full border border-border px-3 text-[12px] font-semibold text-foreground"
              >
                {venue.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {(!onSurfaceChange || surface === 'tonight') && (
        <div className="pt-1">
          <FeedTabBar<TonightFeed>
            tabs={TONIGHT_FEEDS}
            value={tonightFeed}
            onChange={setTonightFeed}
            ariaLabel="Tonight feeds"
            variant="pills"
            className="mt-3"
          />

          {tonightFeed === 'foryou' && (
            <>
              {home.empty && (
                <TonightEmptyState
                  empty={home.empty}
                  ctaLabel={onBeFirstPulse && home.startHere ? 'Post a live review' : undefined}
                  onCta={onBeFirstPulse && home.startHere
                    ? () => onBeFirstPulse(home.startHere!.venue)
                    : undefined}
                />
              )}
              {home.startHere && (
                <>
                  <h2 className="pt-4 pb-1 text-[13px] font-semibold text-muted-foreground">Start here</h2>
                  <TonightFeedRow
                    venue={home.startHere.venue}
                    headline={home.startHere.headline}
                    pulses={pulses}
                    onVenueClick={onVenueClick}
                    signedIn={signedIn}
                    following={followedVenueIds.includes(home.startHere.venue.id)}
                    onFollowAuth={onFollowAuth}
                    onToggleFollow={onToggleFollow}
                    onShareVenue={onShareVenue}
                    onImHere={onBeFirstPulse}
                    viewerId={viewerId}
                    replies={replies}
                    agrees={agrees}
                    onPulseReply={onPulseReply}
                    onSameAgree={onSameAgree}
                    onBlockUser={onBlockUser}
                  />
                </>
              )}

              {home.heatingUp.length > 0 && (
                <div>
                  <h2 className="pt-4 pb-1 text-[13px] font-semibold text-muted-foreground">Also heating up</h2>
                  {home.heatingUp.map((pick) => (
                    <TonightFeedRow
                      key={pick.venue.id}
                      venue={pick.venue}
                      headline={pick.headline}
                      pulses={pulses}
                      onVenueClick={onVenueClick}
                      signedIn={signedIn}
                      following={followedVenueIds.includes(pick.venue.id)}
                      onFollowAuth={onFollowAuth}
                      onToggleFollow={onToggleFollow}
                      onShareVenue={onShareVenue}
                      onImHere={onBeFirstPulse}
                      viewerId={viewerId}
                      replies={replies}
                      agrees={agrees}
                      onPulseReply={onPulseReply}
                      onSameAgree={onSameAgree}
                      onBlockUser={onBlockUser}
                    />
                  ))}
                </div>
              )}

              {home.surging.length > 0 && (
                <div>
                  <h2 className="pt-4 pb-1 text-[13px] font-semibold text-muted-foreground">Surging</h2>
                  {home.surging.map((pick) => (
                    <TonightFeedRow
                      key={pick.venue.id}
                      venue={pick.venue}
                      headline={pick.headline}
                      pulses={pulses}
                      onVenueClick={onVenueClick}
                      signedIn={signedIn}
                      following={followedVenueIds.includes(pick.venue.id)}
                      onFollowAuth={onFollowAuth}
                      onToggleFollow={onToggleFollow}
                      onShareVenue={onShareVenue}
                      onImHere={onBeFirstPulse}
                      viewerId={viewerId}
                      replies={replies}
                      agrees={agrees}
                      onPulseReply={onPulseReply}
                      onSameAgree={onSameAgree}
                      onBlockUser={onBlockUser}
                    />
                  ))}
                </div>
              )}

            </>
          )}

          {tonightFeed === 'surging' && (
            home.surging.length === 0 ? (
              <TonightEmptyState
                empty={{
                  headline: 'Nothing surging in the last hour',
                  body: 'Surging uses live reviews already on the map. Guests can browse; posting still needs a sign-in.',
                  steps: ['Open the map', 'Tap a real Seattle pin', 'Post a pulse when you’re there'],
                }}
              />
            ) : (
              home.surging.map((pick) => (
                <TonightFeedRow
                  key={pick.venue.id}
                  venue={pick.venue}
                  headline={pick.headline}
                  pulses={pulses}
                  onVenueClick={onVenueClick}
                  signedIn={signedIn}
                  following={followedVenueIds.includes(pick.venue.id)}
                  onFollowAuth={onFollowAuth}
                  onToggleFollow={onToggleFollow}
                  onShareVenue={onShareVenue}
                  onImHere={onBeFirstPulse}
                  viewerId={viewerId}
                  replies={replies}
                  agrees={agrees}
                  onPulseReply={onPulseReply}
                  onSameAgree={onSameAgree}
                  onBlockUser={onBlockUser}
                />
              ))
            )
          )}

          {tonightFeed === 'open' && (
            <OpenNowFeed
              picks={[home.startHere, ...home.heatingUp, ...home.surging].filter((pick): pick is NonNullable<typeof pick> => Boolean(pick))}
              pulses={pulses}
              onVenueClick={onVenueClick}
              signedIn={signedIn}
              followedVenueIds={followedVenueIds}
              onFollowAuth={onFollowAuth}
              onToggleFollow={onToggleFollow}
              onShareVenue={onShareVenue}
              onImHere={onBeFirstPulse}
              viewerId={viewerId}
              replies={replies}
              agrees={agrees}
              onPulseReply={onPulseReply}
              onSameAgree={onSameAgree}
              onBlockUser={onBlockUser}
            />
          )}

          {tonightFeed === 'following' && (
            !signedIn ? (
              <div>
                <TonightEmptyState empty={TONIGHT_FOLLOWING_GUEST_EMPTY} />
                {onFollowAuth && (
                  <button
                    type="button"
                    className="mt-3 h-12 w-full rounded-full border border-border bg-muted text-[15px] font-bold text-foreground"
                    onClick={onFollowAuth}
                  >
                    Follow
                  </button>
                )}
              </div>
            ) : followingFeed.length === 0 ? (
              <TonightEmptyState empty={TONIGHT_FOLLOWING_SIGNED_IN_EMPTY} />
            ) : (
              followingFeed.map((row) => {
                if (row.kind === 'friend_pulse') {
                  const venue = row.venue
                  if (!venue) return null
                  return (
                    <TonightFeedRow
                      key={`friend-${row.pulse.id}`}
                      venue={venue}
                      headline={row.pulse.caption || `${venue.name} · from someone you follow`}
                      pulses={[row.pulse]}
                      onVenueClick={onVenueClick}
                      signedIn={signedIn}
                      following={followedVenueIds.includes(venue.id)}
                      onFollowAuth={onFollowAuth}
                      onToggleFollow={onToggleFollow}
                      onShareVenue={onShareVenue}
                      onImHere={onBeFirstPulse}
                      onHidePulse={onHidePulse}
                      onPinMyNight={onPinMyNight}
                      pinned={pinnedVenueIds.includes(venue.id)}
                      viewerId={viewerId}
                      replies={replies}
                      agrees={agrees}
                      onPulseReply={onPulseReply}
                      onSameAgree={onSameAgree}
                      onBlockUser={onBlockUser}
                    />
                  )
                }
                return (
                  <TonightFeedRow
                    key={row.venue.id}
                    venue={row.venue}
                    headline={row.latestPulse?.caption
                      ? row.latestPulse.caption
                      : `${row.venue.name} is on your Following list`}
                    pulses={pulses}
                    onVenueClick={onVenueClick}
                    signedIn={signedIn}
                    following
                    onFollowAuth={onFollowAuth}
                    onToggleFollow={onToggleFollow}
                    onShareVenue={onShareVenue}
                    onImHere={onBeFirstPulse}
                    onHidePulse={onHidePulse}
                    onPinMyNight={onPinMyNight}
                    pinned={pinnedVenueIds.includes(row.venue.id)}
                    viewerId={viewerId}
                    replies={replies}
                    agrees={agrees}
                    onPulseReply={onPulseReply}
                    onSameAgree={onSameAgree}
                    onBlockUser={onBlockUser}
                  />
                )
              })
            )
          )}

          {tonightFeed === 'near' && (
            near.venues.length === 0 ? (
              <TonightEmptyState
                empty={{
                  headline: 'Quiet nearby',
                  body: 'Near uses your map pin against the real catalog, or Launch 33 when location is off. Guests can browse; posting still needs a sign-in.',
                  steps: ['Allow location or stay on Launch 33', 'Tap a nearby pin', 'Post a pulse when you’re there'],
                }}
              />
            ) : (
              <>
                {near.usedLaunch33Fallback && (
                  <h2 className="pt-3 text-[13px] font-semibold text-muted-foreground">
                    Launch 33 · location off
                  </h2>
                )}
                {near.venues.map((venue) => (
                  <TonightFeedRow
                    key={venue.id}
                    venue={venue}
                    headline={near.usedLaunch33Fallback
                      ? `${venue.name} is on Launch 33`
                      : `${venue.name} is close`}
                    pulses={pulses}
                    onVenueClick={onVenueClick}
                    signedIn={signedIn}
                    following={followedVenueIds.includes(venue.id)}
                    onFollowAuth={onFollowAuth}
                    onToggleFollow={onToggleFollow}
                    onShareVenue={onShareVenue}
                    onImHere={onBeFirstPulse}
                    viewerId={viewerId}
                    replies={replies}
                    agrees={agrees}
                    onPulseReply={onPulseReply}
                    onSameAgree={onSameAgree}
                    onBlockUser={onBlockUser}
                  />
                ))}
              </>
            )
          )}
          {surface === 'tonight' && <div className="pt-4 pb-3"><InstallAffordance surface="tonight" /></div>}
          <LastNightRecap
            rooms={lastNightRooms}
            signedIn={signedIn}
            onAuth={onLastNightAuth}
            onVenueClick={onVenueClick}
          />
          <div className="pb-2">
            <VenueTypeahead venues={venues} onVenueSelect={onVenueClick} />
          </div>
          {hoodLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-3">
              {hoodLinks.map((hood) => (
                <Link
                  key={hood.slug}
                  to={neighborhoodPath(hood.slug)}
                  className="h-8 rounded-full border border-border px-3 text-[12px] font-semibold text-foreground"
                >
                  {hood.name}
                </Link>
              ))}
            </div>
          )}
          <div className="border-b border-border pb-3">
            <p className="text-[13px] font-semibold text-muted-foreground">Events tonight</p>
            {tonightEvents.length === 0 ? (
              <div className="pt-2">
                <p className="text-[15px] font-semibold text-foreground">{EVENTS_TONIGHT_EMPTY}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{EVENTS_TONIGHT_EMPTY_BODY}</p>
                {onBeFirstPulse && (
                  <EmptySurgingStartHere
                    venues={venues}
                    onVenueClick={onVenueClick}
                    onBeFirstPulse={onBeFirstPulse}
                  />
                )}
              </div>
            ) : (
              <ul className="pt-2">
                {tonightEvents.map((event) => {
                  const venue = venues.find((row) => row.id === event.venueId)
                  return (
                    <li key={event.id} className="flex items-center justify-between gap-2 py-1.5 text-[15px] text-foreground">
                      <span>{event.title}</span>
                      <AddToCalendarButton event={event} venueName={venue?.name} />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function formatTonightMetric(venue: Venue, pulses: Pulse[], activity: VenueMapActivity): string {
  const now = Date.now()
  const recent = pulses.filter((pulse) => {
    if (pulse.venueId !== venue.id) return false
    const age = now - new Date(pulse.createdAt).getTime()
    return age >= 0 && age < 10 * 60 * 1000
  }).length
  const delta = recent * 8
  const deltaText = delta > 0 ? `+${delta} / 10m` : 'steady'
  const verified = activity.latest?.locationVerified === true
  const score = venue.pulseScore
  return verified ? `${score} · ${deltaText} · verified weight` : `${score} · ${deltaText}`
}

function OpenNowFeed({
  picks,
  pulses,
  onVenueClick,
  signedIn,
  followedVenueIds,
  onFollowAuth,
  onToggleFollow,
  onShareVenue,
  onImHere,
  viewerId,
  replies,
  agrees,
  onPulseReply,
  onSameAgree,
  onBlockUser,
}: {
  picks: { venue: Venue; headline: string }[]
  pulses: Pulse[]
  onVenueClick: (venue: Venue) => void
  signedIn: boolean
  followedVenueIds: readonly string[]
  onFollowAuth?: () => void
  onToggleFollow?: (venueId: string) => void
  onShareVenue?: (venue: Venue) => void
  onImHere?: (venue: Venue) => void
  viewerId?: string | null
  replies: readonly PulseReply[]
  agrees: readonly PulseAgree[]
  onPulseReply?: (pulseId: string, venueId: string) => void
  onSameAgree?: (pulseId: string, venueId: string) => void
  onBlockUser?: (userId: string, venueId?: string) => void
}) {
  const open = picks.filter((pick) => isOpenNow(pick.venue))
  if (open.length === 0) {
    return (
      <TonightEmptyState
        empty={{
          headline: 'Nothing with hours open right now',
          body: 'Open now only lists venues that already have hours on the row. Missing hours stay off this chip.',
          steps: ['Check For you', 'Tap a venue', 'Hours show here when the catalog has them'],
        }}
      />
    )
  }
  return (
    <>
      {open.map((pick) => (
        <TonightFeedRow
          key={pick.venue.id}
          venue={pick.venue}
          headline={pick.headline}
          pulses={pulses}
          onVenueClick={onVenueClick}
          signedIn={signedIn}
          following={followedVenueIds.includes(pick.venue.id)}
          onFollowAuth={onFollowAuth}
          onToggleFollow={onToggleFollow}
          onShareVenue={onShareVenue}
          onImHere={onImHere}
          viewerId={viewerId}
          replies={replies}
          agrees={agrees}
          onPulseReply={onPulseReply}
          onSameAgree={onSameAgree}
          onBlockUser={onBlockUser}
        />
      ))}
    </>
  )
}

function TonightFeedRow({
  venue,
  headline,
  pulses,
  onVenueClick,
  signedIn = false,
  following = false,
  onFollowAuth,
  onToggleFollow,
  onShareVenue,
  onImHere,
  onHidePulse,
  onPinMyNight,
  pinned = false,
  viewerId,
  replies = [],
  agrees = [],
  onPulseReply,
  onSameAgree,
  onBlockUser,
}: {
  venue: Venue
  headline: string
  pulses: Pulse[]
  onVenueClick: (venue: Venue) => void
  signedIn?: boolean
  following?: boolean
  onFollowAuth?: () => void
  onToggleFollow?: (venueId: string) => void
  onShareVenue?: (venue: Venue) => void
  onImHere?: (venue: Venue) => void
  onHidePulse?: (pulseId: string) => void
  onPinMyNight?: (venueId: string) => void
  pinned?: boolean
  viewerId?: string | null
  replies?: readonly PulseReply[]
  agrees?: readonly PulseAgree[]
  onPulseReply?: (pulseId: string, venueId: string) => void
  onSameAgree?: (pulseId: string, venueId: string) => void
  onBlockUser?: (userId: string, venueId?: string) => void
}) {
  const activity = getVenueMapActivity(venue, pulses)
  const glance = buildTrustGlance(venue, pulses, Date.now(), activity)
  const handleFollow = () => {
    if (!signedIn) {
      onFollowAuth?.()
      return
    }
    onToggleFollow?.(venue.id)
  }
  const handleShare = () => {
    if (onShareVenue) {
      onShareVenue(venue)
      return
    }
    void shareVenueFromSurface(venue).then((result) => {
      if (result === 'copied') toast.success('Link copied')
    })
  }
  const open = () => onVenueClick(venue)
  const energyRating: EnergyRating | undefined = activity.latest?.energyRating
  const energyLabel = energyRating
    ? ENERGY_CONFIG[energyRating].label
    : getEnergyLabel(venue.pulseScore)
  const why = activity.latest?.caption?.trim() || headline

  return (
    <article className="mt-3 rounded-2xl border border-border bg-card p-3.5">
      <button
        type="button"
        onClick={open}
        aria-label={`${venue.name}, ${why}`}
        className="block w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-foreground">{venue.name}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{why}</p>
            <span className="sr-only">{venueHandle(venue.name)}</span>
          </div>
          <SignalPill tone={toneForEnergy(energyRating ?? energyLabel.toLowerCase())}>{energyLabel}</SignalPill>
        </div>
        <p className="mt-2 text-[12px] font-medium text-accent">
          {formatTonightMetric(venue, pulses, activity)}
        </p>
      </button>
      <div className="mt-2 flex gap-2">
        <FollowVenueButton following={following} onClick={handleFollow} equal />
        <button
          type="button"
          className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-[14px] bg-muted px-2 text-[13px] font-semibold text-foreground touch-manipulation"
          onClick={handleShare}
        >
          Share
        </button>
        <button
          type="button"
          className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-[14px] bg-[#1a384d] px-2 text-[13px] font-semibold text-accent touch-manipulation"
          onClick={() => (onImHere ? onImHere(venue) : open())}
        >
          I’m here
        </button>
      </div>
      {onPinMyNight && (
        <button type="button" className="text-[12px] font-semibold text-muted-foreground" onClick={() => onPinMyNight(venue.id)}>
          {pinned ? 'Pinned' : 'Pin'}
        </button>
      )}
      {activity.latest?.doorChips && activity.latest.doorChips.length > 0 && (
        <div className="pt-2"><DoorChipRow value={activity.latest.doorChips} readOnly /></div>
      )}
      {doorRollupLabel(pulses, venue.id) && (
        <p className="pt-1 text-[12px] font-semibold text-foreground">{doorRollupLabel(pulses, venue.id)}</p>
      )}
      <div className="pt-1"><OpenNowChip venue={venue} /></div>
      <TrustPinChips chips={glance.chips} className="mt-1.5" />
      {catalogQualityLine(venue) && (
        <p className="pt-1 text-[13px] text-muted-foreground">{catalogQualityLine(venue)}</p>
      )}
      {activity.latest && (
        <PulseThreadActions
          pulseId={activity.latest.id}
          venueId={venue.id}
          authorUserId={activity.latest.userId}
          viewerId={viewerId}
          doorChips={activity.latest.doorChips}
          replies={replies}
          agrees={agrees}
          onReply={(id) => onPulseReply?.(id, venue.id)}
          onSame={(id) => onSameAgree?.(id, venue.id)}
          onBlock={onBlockUser ? (userId) => onBlockUser(userId, venue.id) : undefined}
        />
      )}
      {onHidePulse && activity.latest && (
        <button type="button" className="pt-1 text-[12px] text-muted-foreground" onClick={() => onHidePulse(activity.latest!.id)}>
          Hide this pulse
        </button>
      )}
    </article>
  )
}
