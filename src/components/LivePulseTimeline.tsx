import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import { EmptySurgingStartHere } from '@/components/EmptySurgingStartHere'
import type { PulseWithUser, Venue } from '@/lib/types'
import { getLiveNowReviews } from '@/lib/live-reviews'
import { authorHandle } from '@/lib/venue-handle'
import { shareVenueFromSurface } from '@/lib/sharing'
import { toast } from 'sonner'

interface LivePulseTimelineProps {
  pulses: PulseWithUser[]
  venues: Venue[]
  onVenueClick: (venue: Venue) => void
  onBeFirstPulse?: (venue: Venue) => void
  onShareVenue?: (venue: Venue) => void
}

/** City-wide Live now — X timeline of real venue pulses. No invented venues. */
export function LivePulseTimeline({
  pulses,
  venues,
  onVenueClick,
  onBeFirstPulse,
  onShareVenue,
}: LivePulseTimelineProps) {
  const live = getLiveNowReviews(pulses)
  const byId = new Map(venues.map((venue) => [venue.id, venue]))

  return (
    <section aria-labelledby="city-live-heading">
      <h2 id="city-live-heading" className="sr-only">
        Live now
      </h2>
      {live.length === 0 ? (
        <EmptySurgingStartHere
          venues={venues}
          onVenueClick={onVenueClick}
          onBeFirstPulse={onBeFirstPulse ?? onVenueClick}
        />
      ) : (
        <div>
          {live.map((pulse) => {
            const venue = pulse.venue ?? byId.get(pulse.venueId)
            if (!venue) return null
            const name = pulse.user?.username || venue.name
            return (
              <LiveReviewFeedCard
                key={pulse.id}
                as="button"
                energyRating={pulse.energyRating}
                createdAt={pulse.createdAt}
                caption={pulse.caption}
                unverified={pulse.locationVerified === false}
                displayName={name}
                handle={authorHandle(pulse.user?.username, venue.name)}
                avatarUrl={pulse.user?.profilePhoto}
                onClick={() => onVenueClick(venue)}
                onReply={() => onVenueClick(venue)}
                onShare={() => {
                  if (onShareVenue) {
                    onShareVenue(venue)
                    return
                  }
                  void shareVenueFromSurface(venue).then((result) => {
                    if (result === 'copied') toast.success('Link copied')
                  })
                }}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
