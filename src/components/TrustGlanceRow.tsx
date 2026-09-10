import type { Pulse, Venue } from '@/lib/types'
import { buildTrustGlance } from '@/lib/trust-glance'
import type { VenueMapActivity } from '@/lib/map-live-reviews'

interface TrustGlanceRowProps {
  venue: Venue
  pulses: Pulse[]
  activity?: VenueMapActivity
}

export function TrustGlanceRow({ venue, pulses, activity }: TrustGlanceRowProps) {
  const glance = buildTrustGlance(venue, pulses, Date.now(), activity)
  return (
    <p className="text-xs text-muted-foreground" data-testid="trust-glance">
      {glance.line}
    </p>
  )
}
