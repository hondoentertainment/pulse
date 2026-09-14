import { HOP_NEXT_CTA } from '@/lib/hop-next'
import type { Venue } from '@/lib/types'

export function HopNextRow({
  venues,
  onVenueClick,
}: {
  venues: Venue[]
  onVenueClick: (venue: Venue) => void
}) {
  if (venues.length === 0) return null
  return (
    <section className="space-y-2" aria-label={HOP_NEXT_CTA}>
      <p className="text-[13px] font-semibold text-muted-foreground">{HOP_NEXT_CTA}</p>
      <div className="flex flex-wrap gap-2">
        {venues.map((venue) => (
          <button
            key={venue.id}
            type="button"
            className="h-9 rounded-full border border-border px-3 text-[13px] font-semibold text-foreground"
            onClick={() => onVenueClick(venue)}
          >
            {venue.name}
          </button>
        ))}
      </div>
    </section>
  )
}
