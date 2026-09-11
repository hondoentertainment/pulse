import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import type { PulseWithUser, Venue } from '@/lib/types'
import { getLiveNowReviews } from '@/lib/live-reviews'
import { venueHandle } from '@/lib/venue-handle'

interface LivePulseTimelineProps {
  pulses: PulseWithUser[]
  venues: Venue[]
  onVenueClick: (venue: Venue) => void
}

/** City-wide Live now — X timeline of real venue pulses. No invented venues. */
export function LivePulseTimeline({ pulses, venues, onVenueClick }: LivePulseTimelineProps) {
  const live = getLiveNowReviews(pulses)
  const byId = new Map(venues.map((venue) => [venue.id, venue]))

  return (
    <section aria-labelledby="city-live-heading">
      <h2 id="city-live-heading" className="sr-only">
        Live now
      </h2>
      {live.length === 0 ? (
        <div className="border-b border-border py-6">
          <p className="text-[15px] text-foreground">Quiet nearby — no live reviews in the last hour.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Map → venue → pulse. Browse the real Seattle catalog, then post when you’re there.
          </p>
        </div>
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
                handle={venueHandle(venue.name)}
                avatarUrl={pulse.user?.profilePhoto}
                onClick={() => onVenueClick(venue)}
                onReply={() => onVenueClick(venue)}
                onShare={() => onVenueClick(venue)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
