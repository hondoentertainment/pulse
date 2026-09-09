import { ENERGY_CONFIG, type PulseWithUser } from '@/lib/types'
import {
  getLiveNowReviews,
  relativeReviewTime,
  snippetCaption,
} from '@/lib/live-reviews'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { track } from '@/lib/observability/analytics'

interface LiveNowStripProps {
  venueId: string
  pulses: PulseWithUser[]
  onSelect: (pulse: PulseWithUser) => void
}

export function LiveNowStrip({ venueId, pulses, onSelect }: LiveNowStripProps) {
  const liveNow = getLiveNowReviews(pulses, venueId)
  if (liveNow.length === 0) return null

  return (
    <section aria-labelledby="live-now-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="live-now-heading" className="text-xl font-bold">
          Live now
        </h2>
        <p className="text-xs text-muted-foreground">
          Last 90 min · {liveNow.length} review{liveNow.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {liveNow.map((pulse, index) => {
          const energy = ENERGY_CONFIG[pulse.energyRating]
          const thumb = pulse.photos[0]
          return (
            <button
              key={pulse.id}
              type="button"
              onClick={() => {
                track('pulse_viewed', {
                  pulseId: pulse.id,
                  venueId,
                  position: index,
                  feed: 'live_now',
                })
                onSelect(pulse)
              }}
              className="w-[220px] shrink-0 rounded-[16px] border border-white/10 bg-card/90 p-3 text-left transition-colors hover:border-white/25"
            >
              <div className="flex items-start justify-between gap-2">
                <Badge
                  className="text-[11px] font-semibold"
                  style={{ backgroundColor: energy.color, color: 'white', borderColor: energy.color }}
                >
                  {energy.emoji} {energy.label}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {relativeReviewTime(pulse.createdAt)}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-foreground">
                {snippetCaption(pulse.caption, 96) || 'On-site energy'}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <span className="text-[11px] text-muted-foreground">No photo</span>
                )}
                {pulse.locationVerified === false && (
                  <span className={cn('text-[10px] uppercase tracking-wide text-amber-400')}>
                    Unverified
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
