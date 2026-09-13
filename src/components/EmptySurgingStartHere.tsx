import type { Venue } from '@/lib/types'
import {
  EMPTY_SURGING_BODY,
  EMPTY_SURGING_CTA,
  EMPTY_SURGING_HEADLINE,
  EMPTY_SURGING_START_HERE,
  listEmptySurgingStartHere,
} from '@/lib/empty-surging'
import { venueHandle } from '@/lib/venue-handle'
import { UX_PILL_IDLE } from '@/lib/ux-chrome'

interface EmptySurgingStartHereProps {
  venues: readonly Venue[]
  onVenueClick: (venue: Venue) => void
  onBeFirstPulse: (venue: Venue) => void
}

export function EmptySurgingStartHere({
  venues,
  onVenueClick,
  onBeFirstPulse,
}: EmptySurgingStartHereProps) {
  const startHere = listEmptySurgingStartHere(venues)

  return (
    <div className="border-y border-border py-5">
      <p className="text-[15px] font-semibold text-foreground">{EMPTY_SURGING_HEADLINE}</p>
      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{EMPTY_SURGING_BODY}</p>
      {startHere.length > 0 && (
        <div className="pt-4">
          <h3 className="pb-1 text-[13px] font-semibold text-muted-foreground">
            {EMPTY_SURGING_START_HERE}
          </h3>
          <ul>
            {startHere.map((venue) => (
              <li key={venue.id} className="flex items-center gap-2 border-b border-border py-3">
                <button
                  type="button"
                  onClick={() => onVenueClick(venue)}
                  className="min-w-0 flex-1 text-left"
                  aria-label={`Open ${venue.name}`}
                >
                  <span className="block truncate text-[15px] font-bold text-foreground">
                    {venue.name}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {[venueHandle(venue.name), venue.neighborhood].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onBeFirstPulse(venue)}
                  className={`h-12 shrink-0 rounded-full px-4 text-[13px] font-bold ${UX_PILL_IDLE}`}
                >
                  {EMPTY_SURGING_CTA}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
