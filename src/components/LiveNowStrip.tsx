import { type PulseWithUser } from '@/lib/types'
import { getLiveNowReviews } from '@/lib/live-reviews'
import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import { track } from '@/lib/observability/analytics'

interface LiveNowStripProps {
  venueId: string
  pulses: PulseWithUser[]
  onSelect: (pulse: PulseWithUser) => void
}

export function LiveNowStrip({ venueId, pulses, onSelect }: LiveNowStripProps) {
  const liveNow = getLiveNowReviews(pulses, venueId)
  if (liveNow.length === 0) return null

  return (
    <section aria-labelledby="live-now-heading" className="space-y-3.5">
      <h2 id="live-now-heading" className="text-base font-bold">
        Live now
      </h2>
      <div className="space-y-3">
        {liveNow.map((pulse, index) => (
          <LiveReviewFeedCard
            key={pulse.id}
            as="button"
            energyRating={pulse.energyRating}
            createdAt={pulse.createdAt}
            caption={pulse.caption}
            unverified={pulse.locationVerified === false}
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
    </section>
  )
}
