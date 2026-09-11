import type { Pulse, Venue } from '@/lib/types'
import { buildTrustGlance } from '@/lib/trust-glance'
import type { VenueMapActivity } from '@/lib/map-live-reviews'
import { TrustPinChips } from '@/components/TrustPinChips'

interface TrustGlanceRowProps {
  venue: Venue
  pulses: Pulse[]
  activity?: VenueMapActivity
}

export function TrustGlanceRow({ venue, pulses, activity }: TrustGlanceRowProps) {
  const glance = buildTrustGlance(venue, pulses, Date.now(), activity)
  return (
    <div data-testid="trust-glance" className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {glance.line}
      </p>
      <TrustPinChips chips={glance.chips} />
    </div>
  )
}
