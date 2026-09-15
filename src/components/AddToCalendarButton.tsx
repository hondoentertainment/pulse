import { ADD_TO_CALENDAR_CTA, downloadEventIcs } from '@/lib/event-ics'
import type { CatalogEvent } from '@/lib/events-tonight'

export function AddToCalendarButton({
  event,
  venueName,
}: {
  event: CatalogEvent
  venueName?: string | null
}) {
  return (
    <button
      type="button"
      className="h-8 rounded-full border border-border px-3 text-[12px] font-semibold text-foreground"
      onClick={() => {
        downloadEventIcs(event, venueName)
      }}
    >
      {ADD_TO_CALENDAR_CTA}
    </button>
  )
}
