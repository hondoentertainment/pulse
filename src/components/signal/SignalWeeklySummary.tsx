import { useEffect, useMemo } from 'react'
import { CalendarCheck, TrendDown, TrendUp } from '@phosphor-icons/react'
import { buildWeeklySummary } from '@/lib/signal-summary'
import type { SignalEntry } from '@/lib/signal-insights'
import { trackEvent } from '@/lib/analytics'

/**
 * Week-in-review card for the Trends page: check-in count, average, best day,
 * the tag that lifted the week, and movement vs. the previous week. Hidden
 * until the current window has enough entries to be meaningful.
 */
export function SignalWeeklySummary({ entries }: { entries: SignalEntry[] }) {
  const summary = useMemo(() => buildWeeklySummary(entries), [entries])

  useEffect(() => {
    if (summary.hasEnoughData) {
      trackEvent({
        type: 'signal_weekly_summary_view',
        timestamp: Date.now(),
        checkInCount: summary.checkInCount,
        averageScore: summary.averageScore,
      })
    }
  }, [summary.hasEnoughData, summary.checkInCount, summary.averageScore])

  if (!summary.hasEnoughData) return null

  const delta = summary.deltaVsPreviousWeek
  const deltaLabel = delta === 0 ? 'Steady vs last week' : `${delta > 0 ? '+' : ''}${delta} vs last week`

  return (
    <section className="rounded-[2rem] border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        <CalendarCheck size={18} weight="fill" />
        <p className="text-sm font-bold">This week</p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-5xl font-black leading-none tracking-tight">{summary.averageScore}</p>
          <p className="mt-1 text-sm text-muted-foreground">average signal</p>
        </div>
        {delta !== 0 && (
          <span
            className={
              delta > 0
                ? 'flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-black text-emerald-400'
                : 'flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-black text-amber-300'
            }
          >
            {delta > 0 ? <TrendUp size={15} weight="bold" /> : <TrendDown size={15} weight="bold" />}
            {deltaLabel}
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-secondary/40 px-3 py-2.5">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Check-ins</dt>
          <dd className="mt-1 text-lg font-black">{summary.checkInCount}</dd>
        </div>
        {summary.bestDay && (
          <div className="rounded-2xl bg-secondary/40 px-3 py-2.5">
            <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Best day</dt>
            <dd className="mt-1 truncate text-lg font-black">{summary.bestDay.label}</dd>
          </div>
        )}
        {summary.topLiftTag && (
          <div className="rounded-2xl bg-secondary/40 px-3 py-2.5">
            <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Top lift</dt>
            <dd className="mt-1 truncate text-lg font-black capitalize">{summary.topLiftTag}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
