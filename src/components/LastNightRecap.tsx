import { LAST_NIGHT_CTA, LAST_NIGHT_EMPTY, LAST_NIGHT_EMPTY_BODY, type LastNightRoom } from '@/lib/last-night'
import type { Venue } from '@/lib/types'

export function LastNightRecap({
  rooms,
  signedIn,
  onAuth,
  onVenueClick,
}: {
  rooms: LastNightRoom[]
  signedIn: boolean
  onAuth?: () => void
  onVenueClick: (venue: Venue) => void
}) {
  return (
    <section className="border-b border-border pb-3 pt-2" aria-label={LAST_NIGHT_CTA}>
      <p className="text-[13px] font-semibold text-muted-foreground">{LAST_NIGHT_CTA}</p>
      {!signedIn ? (
        <button
          type="button"
          className="mt-2 h-9 rounded-full border border-border px-3 text-[13px] font-semibold"
          onClick={onAuth}
        >
          Sign in for last night
        </button>
      ) : rooms.length === 0 ? (
        <div className="pt-1">
          <p className="text-[15px] font-semibold text-foreground">{LAST_NIGHT_EMPTY}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{LAST_NIGHT_EMPTY_BODY}</p>
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {rooms.map((row) => (
            <li key={row.venue.id}>
              <button
                type="button"
                className="text-left text-[15px] font-semibold text-foreground"
                onClick={() => onVenueClick(row.venue)}
              >
                {row.venue.name}
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  {row.reasons.join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
