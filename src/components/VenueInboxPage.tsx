import { useMemo } from 'react'
import type { Pulse, User, Venue } from '@/lib/types'
import type { VenueClaim } from '@/lib/venue-owner'
import {
  averageEnergyScore,
  canAccessVenueInbox,
  getTonightLiveReviews,
} from '@/lib/live-reviews'
import { CaretLeft } from '@phosphor-icons/react'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { track } from '@/lib/observability/analytics'
import { LiveReviewFeedCard } from '@/components/LiveReviewFeedCard'

interface VenueInboxPageProps {
  venue: Venue
  pulses: Pulse[]
  currentUser: User | null
  claims?: VenueClaim[]
  staffRoles?: Array<{ venueId: string; userId: string }>
  onBack: () => void
}

export function VenueInboxPage({
  venue,
  pulses,
  currentUser,
  claims = [],
  staffRoles = [],
  onBack,
}: VenueInboxPageProps) {
  const allowed = canAccessVenueInbox({
    userId: currentUser?.id,
    venueId: venue.id,
    claims,
    staffRoles,
  })
  const tonight = useMemo(
    () => getTonightLiveReviews(pulses, venue.id),
    [pulses, venue.id],
  )
  const visibleTonight = allowed ? tonight : []
  const avgEnergy = averageEnergyScore(visibleTonight)

  if (!isFeatureEnabled('venueInbox')) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <button type="button" onClick={onBack} className="mb-4 rounded-lg p-2 hover:bg-muted">
          <CaretLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Venue inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Venue inbox is turned off by the venueInbox feature flag.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-start gap-3 px-5 pb-2 pt-6">
          <button type="button" onClick={onBack} className="mt-0.5 rounded-lg p-2 hover:bg-muted" aria-label="Back">
            <CaretLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Tonight’s reviews</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{venue.name} · owner inbox</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-3.5 px-5 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[18px] bg-[#17171C] p-3.5">
            <p className="text-[22px] font-bold leading-none text-primary">{visibleTonight.length}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Live reviews</p>
          </div>
          <div className="rounded-[18px] bg-[#17171C] p-3.5">
            <p className="text-[22px] font-bold leading-none text-[var(--energy-buzzing)]">{avgEnergy}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Avg energy</p>
          </div>
        </div>

        {!allowed ? (
          <p className="text-xs text-muted-foreground">
            Empty state until claim / venue_staff verified
          </p>
        ) : tonight.length === 0 ? (
          <div className="rounded-[18px] bg-[#17171C] p-3.5">
            <h2 className="text-base font-semibold">No live reviews tonight</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When patrons post energy + caption reviews after 4pm, they will
              appear here. Nothing is fabricated.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tonight.map((pulse, index) => (
              <li
                key={pulse.id}
                onClick={() => {
                  track('pulse_viewed', {
                    pulseId: pulse.id,
                    venueId: venue.id,
                    position: index,
                    feed: 'inbox',
                  })
                }}
              >
                <LiveReviewFeedCard
                  energyRating={pulse.energyRating}
                  createdAt={pulse.createdAt}
                  caption={pulse.caption}
                  unverified={pulse.locationVerified === false}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
