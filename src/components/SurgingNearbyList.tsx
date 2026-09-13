import { memo, useMemo } from 'react'
import { Venue, Pulse } from '@/lib/types'
import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import { PulseActionRow } from '@/components/ux/PulseActionRow'
import { TimelineAvatar } from '@/components/ux/TimelineAvatar'
import { EmptySurgingStartHere } from '@/components/EmptySurgingStartHere'
import { venueHandle } from '@/lib/venue-handle'
import { getSurgingNearbyVenues, getVenueMapActivityFromLive, buildVenueActivityMap, formatSurgingRailSubline } from '@/lib/map-live-reviews'
import { getEnergyLabel } from '@/lib/pulse-engine'
import { buildTrustGlance } from '@/lib/trust-glance'
import { TrustPinChips } from '@/components/TrustPinChips'
import { shareVenueFromSurface } from '@/lib/sharing'
import { toast } from 'sonner'

interface SurgingNearbyListProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  onVenueClick: (venue: Venue) => void
  onBeFirstPulse?: (venue: Venue) => void
  onShareVenue?: (venue: Venue) => void
}

export const SurgingNearbyList = memo(function SurgingNearbyList({
  venues,
  pulses,
  userLocation,
  unitSystem: _unitSystem,
  onVenueClick,
  onBeFirstPulse,
  onShareVenue,
}: SurgingNearbyListProps) {
  const activityByVenueId = useMemo(
    () => buildVenueActivityMap(venues, pulses),
    [venues, pulses],
  )
  const nearby = useMemo(
    () => getSurgingNearbyVenues(venues, pulses, { userLocation, activityByVenue: activityByVenueId }),
    [venues, pulses, userLocation, activityByVenueId],
  )

  return (
    <section aria-labelledby="surging-nearby-heading">
      <h2 id="surging-nearby-heading" className="pb-2 text-[13px] font-semibold text-muted-foreground">
        Surging nearby
      </h2>
      {nearby.length === 0 ? (
        <EmptySurgingStartHere
          venues={venues}
          onVenueClick={onVenueClick}
          onBeFirstPulse={onBeFirstPulse ?? onVenueClick}
        />
      ) : (
        <div>
          {nearby.map((venue) => {
            const activity = activityByVenueId.get(venue.id)
              ?? getVenueMapActivityFromLive(venue, undefined)
            const glance = buildTrustGlance(venue, pulses, Date.now(), activity)
            const open = () => onVenueClick(venue)
            const handleShare = () => {
              if (onShareVenue) {
                onShareVenue(venue)
                return
              }
              void shareVenueFromSurface(venue).then((result) => {
                if (result === 'copied') toast.success('Link copied')
              })
            }
            if (activity.latest) {
              return (
                <LiveReviewFeedCard
                  key={venue.id}
                  as="button"
                  energyRating={activity.latest.energyRating}
                  createdAt={activity.latest.createdAt}
                  caption={activity.latest.caption || formatSurgingRailSubline(activity)}
                  unverified={activity.latest.locationVerified === false}
                  displayName={venue.name}
                  handle={venueHandle(venue.name)}
                  trustChips={glance.chips}
                  onClick={open}
                  onShare={handleShare}
                />
              )
            }
            return (
              <article key={venue.id} className="flex gap-3 border-b border-border py-3.5">
                <TimelineAvatar name={venue.name} />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label={`Open ${venue.name}${activity.countLabel ? `, ${activity.countLabel}` : ''}`}
                    onClick={open}
                    className="block w-full text-left"
                  >
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <h3 className="truncate text-[15px] font-bold text-foreground">{venue.name}</h3>
                      <span className="truncate text-[14px] text-muted-foreground">
                        {venueHandle(venue.name)}
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] text-foreground">
                      {activity.countLabel || getEnergyLabel(venue.pulseScore)}
                    </p>
                    <TrustPinChips chips={glance.chips} className="mt-1.5" />
                  </button>
                  <PulseActionRow onReply={open} onShare={handleShare} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
})
