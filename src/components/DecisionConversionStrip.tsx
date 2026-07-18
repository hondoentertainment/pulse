import { useEffect, useState } from 'react'
import { getEvents } from '@/lib/analytics'
import { analyzeDecisionConversion } from '@/lib/decision-analytics'
import { cn } from '@/lib/utils'

interface DecisionConversionStripProps {
  className?: string
  /** Poll interval for live session stats (ms). 0 = once on mount. */
  refreshMs?: number
  compact?: boolean
}

/**
 * North-star Decision Conversion Rate (PRD §2.1 / §8.1) from in-session analytics.
 */
export function DecisionConversionStrip({
  className,
  refreshMs = 4000,
  compact = false,
}: DecisionConversionStripProps) {
  const [stats, setStats] = useState(() => analyzeDecisionConversion(getEvents()))

  useEffect(() => {
    const refresh = () => setStats(analyzeDecisionConversion(getEvents()))
    refresh()
    if (refreshMs <= 0) return
    const id = window.setInterval(refresh, refreshMs)
    return () => window.clearInterval(id)
  }, [refreshMs])

  const pct = Math.round(stats.rate * 100)
  const label =
    stats.qualifiedSessions === 0
      ? 'No decision sessions yet tonight'
      : `${pct}% conversion · ${stats.conversions}/${stats.qualifiedSessions} sessions`

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card/70 px-3 py-2',
        className,
      )}
      data-testid="decision-conversion-strip"
      role="status"
      aria-label={`Decision conversion rate: ${label}`}
    >
      {!compact && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Decision conversion
        </p>
      )}
      <p className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>{label}</p>
      {!compact && (
        <p className="text-[11px] text-muted-foreground">
          Go · directions · save · share · arrival within the session
        </p>
      )}
    </div>
  )
}
