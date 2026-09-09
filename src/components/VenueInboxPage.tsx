import { useMemo } from 'react'
import type { Pulse, User, Venue } from '@/lib/types'
import type { VenueClaim } from '@/lib/venue-owner'
import {
  canAccessVenueInbox,
  energyChipLabel,
  getTonightLiveReviews,
  relativeReviewTime,
  snippetCaption,
} from '@/lib/live-reviews'
import { ENERGY_CONFIG } from '@/lib/types'
import { CaretLeft } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { track } from '@/lib/observability/analytics'

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
      <div className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={onBack} className="rounded-lg p-2 hover:bg-muted" aria-label="Back">
            <CaretLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Venue inbox</h1>
            <p className="text-xs text-muted-foreground">{venue.name} · tonight’s live reviews</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {!allowed ? (
          <div className="rounded-[18px] border border-dashed border-white/20 bg-card/70 p-5">
            <h2 className="text-lg font-semibold">Claim needed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This read-only inbox is for verified venue owners and staff.
              Claim is not a full CRM yet — associate this venue via a verified
              claim or a venue_staff role to see tonight’s live reviews.
            </p>
          </div>
        ) : tonight.length === 0 ? (
          <div className="rounded-[18px] border border-white/10 bg-card/70 p-5">
            <h2 className="text-lg font-semibold">No live reviews tonight</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When patrons post energy + caption reviews after 4pm, they will
              appear here. Nothing is fabricated.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tonight.map((pulse, index) => {
              const energy = ENERGY_CONFIG[pulse.energyRating]
              return (
                <li
                  key={pulse.id}
                  className="rounded-[16px] border border-white/10 bg-card/90 p-4"
                  onClick={() => {
                    track('pulse_viewed', {
                      pulseId: pulse.id,
                      venueId: venue.id,
                      position: index,
                      feed: 'inbox',
                    })
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      style={{ backgroundColor: energy.color, color: 'white', borderColor: energy.color }}
                    >
                      {energyChipLabel(pulse.energyRating)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{relativeReviewTime(pulse.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm">{snippetCaption(pulse.caption, 200)}</p>
                  {pulse.locationVerified === false && (
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-amber-400">Unverified location</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
