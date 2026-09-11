import { TimelineAvatar } from '@/components/ux/TimelineAvatar'
import { venueHandle } from '@/lib/venue-handle'

interface ComposerVenueChipProps {
  name: string
  nearVenue?: boolean
  showAvatar?: boolean
}

/** Venue attachment chip — X media-style, used in the Uber one-thumb composer. */
export function ComposerVenueChip({
  name,
  nearVenue = false,
  showAvatar = true,
}: ComposerVenueChipProps) {
  return (
    <div
      className="inline-flex w-full max-w-full items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2"
      data-testid="composer-venue-chip"
    >
      {showAvatar && <TimelineAvatar name={name} className="h-7 w-7 text-[11px]" />}
      <span className="truncate text-[13px] font-semibold text-foreground">
        {nearVenue ? `${name} · near venue ✓` : `${name} ${venueHandle(name)}`}
      </span>
    </div>
  )
}
