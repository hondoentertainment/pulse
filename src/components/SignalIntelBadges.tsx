import { computeVenueSignal } from '@/lib/venue-signal'
import type { Pulse, Venue } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { EnergyTrend, SignalConfidence } from '@/lib/decision-explanations'

interface SignalIntelBadgesProps {
  venue: Venue
  pulses: Pulse[]
  className?: string
  compact?: boolean
}

const CONFIDENCE_STYLES: Record<SignalConfidence, string> = {
  high: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  none: 'border-border bg-muted/40 text-muted-foreground',
}

const TREND_LABELS: Record<EnergyTrend, string> = {
  rising: 'Rising',
  steady: 'Steady',
  fading: 'Cooling',
  unknown: 'Unknown',
}

function freshnessShort(minutes: number | null, reportCount: number): string {
  if (minutes === null || reportCount === 0) return 'No signal'
  if (minutes <= 15) return `${minutes}m ago`
  if (minutes <= 90) return `${minutes}m ago`
  return 'Aging'
}

export function SignalIntelBadges({ venue, pulses, className, compact = false }: SignalIntelBadgesProps) {
  const signal = computeVenueSignal(venue, pulses)

  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      data-testid="signal-intel-badges"
      data-venue-id={venue.id}
    >
      <span className={cn('rounded-full border px-2 py-0.5 font-mono uppercase', compact ? 'text-[9px]' : 'text-[10px]', CONFIDENCE_STYLES[signal.confidence])}>
        {signal.confidence === 'none' ? 'No confidence' : `${signal.confidence} confidence`}
      </span>
      {signal.trend !== 'unknown' && (
        <span className={cn('rounded-full border border-border bg-background px-2 py-0.5 font-mono text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px]')}>
          {TREND_LABELS[signal.trend]}
        </span>
      )}
      <span className={cn('rounded-full border border-border bg-background px-2 py-0.5 font-mono text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px]')}>
        {freshnessShort(signal.freshnessMinutes, signal.reportCount)}
      </span>
    </div>
  )
}
