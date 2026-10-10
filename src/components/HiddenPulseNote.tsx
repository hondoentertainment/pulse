import { ownerHiddenCopy, type OwnerHiddenPulse } from '@/lib/pulse-hide'
import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'

function energyLabel(rating: string): string {
  if (rating in ENERGY_CONFIG) return ENERGY_CONFIG[rating as EnergyRating].label
  return rating
}

export function HiddenPulseNote({
  pulse,
  onRepost,
  onAskReview,
}: {
  pulse: OwnerHiddenPulse
  onRepost?: (pulse: OwnerHiddenPulse) => void
  onAskReview?: (pulse: OwnerHiddenPulse) => void
}) {
  const copy = ownerHiddenCopy({ hiddenAt: pulse.hiddenAt, note: pulse.note })
  return (
    <article
      data-testid="hidden-pulse-note"
      className="space-y-3 rounded-2xl border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
            {energyLabel(pulse.energyRating)}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Hidden
          </span>
        </div>
      </div>
      {pulse.caption && (
        <p className="text-[14px] text-foreground">{pulse.caption}</p>
      )}
      <p className="text-[12px] text-muted-foreground">{copy.line}</p>
      {copy.note && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-accent">Admin resolution note</p>
          </div>
          <p className="mt-1 text-[14px] text-foreground">{copy.note}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Resolved by a Pulse admin</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onRepost?.(pulse)}
          className="h-11 rounded-[14px] border border-border text-[13px] font-semibold text-foreground"
        >
          Repost without name
        </button>
        <button
          type="button"
          onClick={() => onAskReview?.(pulse)}
          className="h-11 rounded-[14px] bg-foreground text-[13px] font-semibold text-background"
        >
          Ask for review
        </button>
      </div>
    </article>
  )
}
