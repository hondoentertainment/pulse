import { openNowChip } from '@/lib/open-now'
import type { Venue } from '@/lib/types'

export function OpenNowChip({ venue, now }: { venue: Pick<Venue, 'hours'>; now?: Date }) {
  const label = openNowChip(venue, now)
  if (!label) return null
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-border px-2.5 text-[11px] font-semibold text-foreground">
      {label}
    </span>
  )
}
