import { computeVenueSignal } from '@/lib/venue-signal'
import { buildLiveReviewProof } from '@/lib/live-reviews'
import type { Pulse, Venue } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { EnergyTrend } from '@/lib/decision-explanations'

interface SignalIntelBadgesProps {
  venue: Venue
  pulses: Pulse[]
  className?: string
  compact?: boolean
}

const TREND_LABELS: Record<EnergyTrend, string> = {
  rising: 'Rising',
  steady: 'Steady',
  fading: 'Cooling',
  unknown: 'Unknown',
}

export function SignalIntelBadges({ venue, pulses, className, compact = false }: SignalIntelBadgesProps) {
  const signal = computeVenueSignal(venue, pulses)
  const proof = buildLiveReviewProof(venue, pulses)
  const trendLabel = signal.trend !== 'unknown' ? TREND_LABELS[signal.trend] : null
  const summary = [proof.proofChip, trendLabel].filter(Boolean).join(', ')

  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      data-testid="signal-intel-badges"
      data-venue-id={venue.id}
      role="status"
      aria-label={`Live reviews: ${summary}`}
    >
      <span
        className={cn(
          'rounded-full border px-2 py-0.5 font-medium',
          compact ? 'text-[9px]' : 'text-[10px]',
          proof.reportCount > 0
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-border bg-muted/40 text-muted-foreground',
        )}
      >
        {proof.proofChip}
      </span>
      {trendLabel && (
        <span
          className={cn(
            'rounded-full border border-border bg-background px-2 py-0.5 font-mono text-muted-foreground',
            compact ? 'text-[9px]' : 'text-[10px]',
          )}
        >
          {trendLabel}
        </span>
      )}
      {proof.proofLine !== proof.proofChip && proof.reportCount > 0 && !compact && (
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {proof.proofLine}
        </span>
      )}
    </div>
  )
}
