import { type PulseWithUser } from '@/lib/types'
import { getLiveNowReviews } from '@/lib/live-reviews'
import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'
import { authorHandle } from '@/lib/venue-handle'
import { track } from '@/lib/observability/analytics'
import { orderPulsesDoorPinnedFirst, type VenueDoorPin } from '@/lib/door-pin'
import { ownerRepliesForLiveNow, type OwnerInboxReply } from '@/lib/owner-inbox'

interface LiveNowStripProps {
  venueId: string
  pulses: PulseWithUser[]
  onSelect: (pulse: PulseWithUser) => void
  venueName?: string
  doorPin?: VenueDoorPin | null
  ownerReplies?: readonly OwnerInboxReply[]
}

export function LiveNowStrip({ venueId, pulses, onSelect, venueName, doorPin, ownerReplies = [] }: LiveNowStripProps) {
  const liveNow = orderPulsesDoorPinnedFirst(getLiveNowReviews(pulses, venueId), doorPin)

  return (
    <section aria-labelledby="live-now-heading">
      <h2 id="live-now-heading" className="pb-1 text-[13px] font-semibold text-muted-foreground">
        Live now
      </h2>
      {liveNow.length === 0 ? (
        <div className="border-y border-border py-5">
          <p className="text-[15px] leading-5 text-muted-foreground">
            No live reviews in the last 90 minutes. Be the first to pulse what’s happening.
          </p>
        </div>
      ) : (
        <div>
          {liveNow.map((pulse, index) => (
            <div key={pulse.id}>
              <LiveReviewFeedCard
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
              {ownerRepliesForLiveNow(ownerReplies, pulse.id).map((reply) => (
                <p key={reply.id} className="pb-2 text-[13px] font-semibold text-foreground">
                  Owner · {reply.body}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
