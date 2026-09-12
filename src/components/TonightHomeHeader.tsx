import { useMemo, useState } from 'react'
import type { Pulse, Venue } from '@/lib/types'
import {
  buildTonightHome,
  listTonightFollowingVenues,
  listTonightNearVenues,
} from '@/lib/tonight-home'
import { TonightEmptyState } from '@/components/TonightEmptyState'
import { FeedTabBar } from '@/components/ux/FeedTabBar'
import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import { PulseActionRow } from '@/components/ux/PulseActionRow'
import { TimelineAvatar } from '@/components/ux/TimelineAvatar'
import { TrustPinChips } from '@/components/TrustPinChips'
import { getVenueMapActivity } from '@/lib/map-live-reviews'
import { formatTimeAgo, getEnergyLabel } from '@/lib/pulse-engine'
import { ENERGY_CONFIG } from '@/lib/types'
import { buildTrustGlance } from '@/lib/trust-glance'
import { venueHandle } from '@/lib/venue-handle'
import { catalogQualityLine } from '@/lib/catalog-quality'
import type { MapHomeSurface } from '@/lib/ux-chrome'

const MAP_TABS = [
  { id: 'tonight' as const, label: 'Tonight' },
  { id: 'live' as const, label: 'Live' },
  { id: 'map' as const, label: 'Map' },
]

type TonightFeed = 'foryou' | 'following' | 'near'

const TONIGHT_FEEDS: readonly { id: TonightFeed; label: string }[] = [
  { id: 'foryou', label: 'For you' },
  { id: 'following', label: 'Following' },
  { id: 'near', label: 'Near' },
]

interface TonightHomeHeaderProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  savedVenueIds?: readonly string[]
  followedVenueIds?: readonly string[]
  locationDenied?: boolean
  onVenueClick: (venue: Venue) => void
  surface?: MapHomeSurface
  onSurfaceChange?: (surface: MapHomeSurface) => void
}

export function TonightHomeHeader({
  venues,
  pulses,
  userLocation,
  savedVenueIds = [],
  followedVenueIds = [],
  locationDenied,
  onVenueClick,
  surface = 'map',
  onSurfaceChange,
}: TonightHomeHeaderProps) {
  const [tonightFeed, setTonightFeed] = useState<TonightFeed>('foryou')
  const home = buildTonightHome({
    venues,
    pulses,
    userLocation,
    savedVenueIds,
    locationDenied,
  })

  const followingVenues = useMemo(
    () => listTonightFollowingVenues(venues, savedVenueIds, followedVenueIds),
    [followedVenueIds, savedVenueIds, venues],
  )

  const near = useMemo(
    () => listTonightNearVenues(venues, userLocation),
    [userLocation, venues],
  )

  return (
    <section aria-labelledby="tonight-home-heading">
      {onSurfaceChange && (
        <FeedTabBar
          tabs={MAP_TABS}
          value={surface}
          onChange={onSurfaceChange}
          ariaLabel="Map home views"
        />
      )}

      {surface !== 'tonight' && (
        <header className="space-y-1 pt-3">
          <h1 id="tonight-home-heading" className="text-[22px] font-bold tracking-tight text-foreground">
            {surface === 'live' ? 'Live' : home.title}
          </h1>
        </header>
      )}
      {surface === 'tonight' && (
        <h1 id="tonight-home-heading" className="sr-only">
          {home.title}
        </h1>
      )}

      {(!onSurfaceChange || surface === 'tonight') && (
        <div className="pt-1">
          <FeedTabBar<TonightFeed>
            tabs={TONIGHT_FEEDS}
            value={tonightFeed}
            onChange={setTonightFeed}
            ariaLabel="Tonight feeds"
            className="mt-1"
          />

          {tonightFeed === 'foryou' && (
            <>
              {home.startHere && (
                <>
                  <h2 className="pt-4 pb-1 text-[13px] font-semibold text-muted-foreground">Start here</h2>
                  <TonightFeedRow
                    venue={home.startHere.venue}
                    headline={home.startHere.headline}
                    pulses={pulses}
                    onVenueClick={onVenueClick}
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
                    />
                  ))}
                </div>
              )}

              {!home.startHere && home.empty && <TonightEmptyState empty={home.empty} />}
            </>
          )}

          {tonightFeed === 'following' && (
            followingVenues.length === 0 ? (
              <TonightEmptyState
                empty={{
                  headline: 'Nothing in Following yet',
                  body: 'No friends graph yet. Save a real Seattle venue from the map — we never invent a list.',
                  steps: ['Open the map', 'Tap a pin you care about', 'Save or follow, then come back'],
                }}
              />
            ) : (
              followingVenues.map((venue) => (
                <TonightFeedRow
                  key={venue.id}
                  venue={venue}
                  headline={`${venue.name} is on your list`}
                  pulses={pulses}
                  onVenueClick={onVenueClick}
                />
              ))
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
                  />
                ))}
              </>
            )
          )}
        </div>
      )}
    </section>
  )
}

function TonightFeedRow({
  venue,
  headline,
  pulses,
  onVenueClick,
}: {
  venue: Venue
  headline: string
  pulses: Pulse[]
  onVenueClick: (venue: Venue) => void
}) {
  const activity = getVenueMapActivity(venue, pulses)
  const glance = buildTrustGlance(venue, pulses, Date.now(), activity)
  if (activity.latest) {
    return (
      <div>
        <LiveReviewFeedCard
          as="button"
          energyRating={activity.latest.energyRating}
          createdAt={activity.latest.createdAt}
          caption={activity.latest.caption || headline}
          unverified={activity.latest.locationVerified === false}
          displayName={venue.name}
          handle={venueHandle(venue.name)}
          trustChips={glance.chips}
          onClick={() => onVenueClick(venue)}
        />
        {catalogQualityLine(venue) && (
          <p className="pb-2 text-[13px] text-muted-foreground">{catalogQualityLine(venue)}</p>
        )}
      </div>
    )
  }

  const open = () => onVenueClick(venue)
  const energyLabel = getEnergyLabel(venue.pulseScore)
  const energyKey = (Object.keys(ENERGY_CONFIG) as Array<keyof typeof ENERGY_CONFIG>)
    .find((key) => ENERGY_CONFIG[key].label === energyLabel)
  const verified = pulses.some((pulse) => pulse.venueId === venue.id && pulse.locationVerified)
  return (
    <article className="flex gap-3 border-b border-border py-3">
      <TimelineAvatar name={venue.name} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={open}
          aria-label={`${venue.name}, ${headline}`}
          className="block min-h-11 w-full text-left"
        >
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-[15px] font-bold text-foreground">{venue.name}</span>
            <span className="truncate text-[15px] text-muted-foreground">{venueHandle(venue.name)}</span>
            {venue.lastPulseAt && (
              <span className="shrink-0 text-[15px] text-muted-foreground">
                · {formatTimeAgo(venue.lastPulseAt).replace(' ago', '')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[15px] leading-5 text-foreground">{headline}</p>
          {catalogQualityLine(venue) && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">{catalogQualityLine(venue)}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-8 items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              {energyKey ? ENERGY_CONFIG[energyKey].label : energyLabel}
            </span>
            <span className="inline-flex min-h-8 items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {verified ? 'Verified' : 'Unverified'}
            </span>
          </div>
          <TrustPinChips chips={glance.chips} className="mt-1.5" />
        </button>
        <PulseActionRow onReply={open} onShare={open} />
      </div>
    </article>
  )
}
