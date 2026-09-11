import { type PulseWithUser } from '@/lib/types'
import { getLiveNowReviews } from '@/lib/live-reviews'
import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import { authorHandle } from '@/lib/venue-handle'
import { track } from '@/lib/observability/analytics'

interface LiveNowStripProps {
  venueId: string
  pulses: PulseWithUser[]
  onSelect: (pulse: PulseWithUser) => void
  venueName?: string
}

export function LiveNowStrip({ venueId, pulses, onSelect, venueName }: LiveNowStripProps) {
  const liveNow = getLiveNowReviews(pulses, venueId)

  return (
    <section aria-labelledby="live-now-heading">
      <h2 id="live-now-heading" className="pb-1 text-[15px] font-bold text-foreground">
        Live now
      </h2>
      {liveNow.length === 0 ? (
        <div className="border-y border-border py-5">
          <p className="text-[15px] text-muted-foreground">
            No live reviews in the last 90 minutes. Be the first to post what’s happening.
          </p>
        </div>
      ) : (
        <div>
          {liveNow.map((pulse, index) => (
            <LiveReviewFeedCard
              key={pulse.id}
              as="button"
              energyRating={pulse.energyRating}
              createdAt={pulse.createdAt}
              caption={pulse.caption}
              unverified={pulse.locationVerified === false}
              displayName={pulse.user?.username || venueName}
              handle={authorHandle(pulse.user?.username, venueName)}
              avatarUrl={pulse.user?.profilePhoto}
              onClick={() => {
                track('pulse_viewed', {
                  pulseId: pulse.id,
                  venueId,
                  position: index,
                  feed: 'live_now',
                })
                onSelect(pulse)
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
