import { TimelineAvatar } from '@/components/ux/TimelineAvatar'
import { venueHandle } from '@/lib/venue-handle'

interface ComposerVenueChipProps {
  name: string
}

/** Venue attachment chip — X media-style, used in the Uber one-thumb composer. */
export function ComposerVenueChip({ name }: ComposerVenueChipProps) {
  return (
    <div
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5"
      data-testid="composer-venue-chip"
    >
      <TimelineAvatar name={name} className="h-7 w-7 text-[11px]" />
      <span className="truncate text-[15px] font-bold text-foreground">{name}</span>
      <span className="shrink-0 text-[13px] text-muted-foreground">{venueHandle(name)}</span>
    </div>
  )
}
