import { useMemo, useState } from 'react'
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
import { Button } from '@/components/ui/button'

interface VenueInboxPageProps {
  venue: Venue
  pulses: Pulse[]
  currentUser: User | null
  claims?: VenueClaim[]
  staffRoles?: Array<{ venueId: string; userId: string }>
  onBack: () => void
  onSubmitClaim?: (input: { evidence: string; notes?: string }) => Promise<void> | void
  claimBusy?: boolean
}

export function VenueInboxPage({
  venue,
  pulses,
  currentUser,
  claims = [],
  staffRoles = [],
  onBack,
  onSubmitClaim,
  claimBusy = false,
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
  const myClaim = claims.find(
    (claim) => claim.venueId === venue.id && claim.claimantUserId === currentUser?.id,
  )
  const [evidence, setEvidence] = useState('')
  const [notes, setNotes] = useState('')

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
    <div className="min-h-screen bg-[#0B0B0E] pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-2xl space-y-3.5 px-5 pb-6 pt-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <CaretLeft size={18} />
            Venue
          </button>
          <h1 className="text-[22px] font-bold text-white">Tonight’s reviews</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{venue.name} · owner inbox</p>
        </div>
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
          <div className="rounded-[18px] bg-[#17171C] p-3.5 space-y-3">
            <h2 className="text-base font-semibold">Claim needed</h2>
            <p className="text-sm text-muted-foreground">
              Tonight’s reviews stay hidden until a verified venue claim or a
              venue_staff row unlocks this inbox. Pending claims do not grant access.
            </p>
            {myClaim?.status === 'pending' ? (
              <p className="text-xs text-muted-foreground">
                Your claim is pending review. We will not invent an approval.
              </p>
            ) : myClaim?.status === 'rejected' ? (
              <p className="text-xs text-muted-foreground">
                Previous claim was rejected{myClaim.rejectedReason ? `: ${myClaim.rejectedReason}` : '.'}
              </p>
            ) : null}
            {currentUser && onSubmitClaim && myClaim?.status !== 'pending' && (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void onSubmitClaim({ evidence, notes })
                }}
              >
                <label className="block text-xs text-muted-foreground" htmlFor="claim-evidence">
                  How are you connected to this venue?
                </label>
                <textarea
                  id="claim-evidence"
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  minLength={8}
                  required
                  placeholder="I manage the door / I own the lease / staff email…"
                  className="w-full min-h-20 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Business name (optional)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" disabled={claimBusy || evidence.trim().length < 8}>
                  {claimBusy ? 'Submitting…' : 'Submit claim'}
                </Button>
              </form>
            )}
            {!currentUser && (
              <p className="text-xs text-muted-foreground">Sign in to submit a venue claim.</p>
            )}
          </div>
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
