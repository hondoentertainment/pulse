import { useEffect, useMemo } from 'react'
import { CalendarBlank, Fire, Sparkle, TrendDown, TrendUp, Trophy } from '@phosphor-icons/react'
import { getPersonalRecords, getSignalPatterns } from '@/lib/signal-patterns'
import type { SignalEntry } from '@/lib/signal-insights'
import { trackEvent } from '@/lib/analytics'

/** Minimum entries before pattern analysis is meaningful enough to show. */
const MIN_ENTRIES_FOR_PATTERNS = 4

function CorrelationRow({
  tag,
  delta,
  occurrences,
  kind,
}: {
  tag: string
  delta: number
  occurrences: number
  kind: 'lift' | 'drain'
}) {
  const positive = kind === 'lift'
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/40 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className={
            positive
              ? 'flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400'
              : 'flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-300'
          }
        >
          {positive ? <TrendUp size={16} weight="bold" /> : <TrendDown size={16} weight="bold" />}
        </span>
        <div>
          <p className="text-sm font-black capitalize leading-none">{tag}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {occurrences} {occurrences === 1 ? 'day' : 'days'}
          </p>
        </div>
      </div>
      <span className={positive ? 'text-sm font-black text-emerald-400' : 'text-sm font-black text-amber-300'}>
        {positive ? '+' : ''}
        {delta}
      </span>
    </li>
  )
}

function RecordChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-base font-black leading-tight">{value}</p>
      </div>
    </div>
  )
}

/**
 * Pattern discovery surface for the Trends page: correlates tags with signal
 * score ("what lifts you / what drains you") and shows lifetime records. Hidden
 * until there are enough entries to say anything trustworthy.
 */
export function SignalPatterns({ entries }: { entries: SignalEntry[] }) {
  const patterns = useMemo(() => getSignalPatterns(entries), [entries])
  const records = useMemo(() => getPersonalRecords(entries), [entries])
  const hasPatterns = patterns.lifts.length > 0 || patterns.drains.length > 0

  useEffect(() => {
    if (entries.length >= MIN_ENTRIES_FOR_PATTERNS && hasPatterns) {
      trackEvent({
        type: 'signal_patterns_view',
        timestamp: Date.now(),
        liftCount: patterns.lifts.length,
        drainCount: patterns.drains.length,
      })
    }
  }, [entries.length, hasPatterns, patterns.lifts.length, patterns.drains.length])

  if (entries.length < MIN_ENTRIES_FOR_PATTERNS) {
    return (
      <section className="rounded-[2rem] border border-dashed border-border bg-card p-5">
        <div className="flex items-center gap-2 text-primary">
          <Sparkle size={18} weight="fill" />
          <p className="text-sm font-bold">Patterns</p>
        </div>
        <p className="mt-2 text-lg font-black leading-6">A few more check-ins unlocks your patterns.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Once you&apos;ve logged {MIN_ENTRIES_FOR_PATTERNS} days, we&apos;ll show which tags lift or drain your signal.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {hasPatterns && (
        <section className="rounded-[2rem] border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <Sparkle size={18} weight="fill" />
            <p className="text-sm font-bold">What moves your signal</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Average score on days you tagged each, vs days you didn&apos;t.
          </p>

          {patterns.lifts.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">Lifts you</p>
              <ul className="mt-2 space-y-2">
                {patterns.lifts.map((c) => (
                  <CorrelationRow key={c.tag} tag={c.tag} delta={c.delta} occurrences={c.occurrences} kind="lift" />
                ))}
              </ul>
            </div>
          )}

          {patterns.drains.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Drains you</p>
              <ul className="mt-2 space-y-2">
                {patterns.drains.map((c) => (
                  <CorrelationRow key={c.tag} tag={c.tag} delta={c.delta} occurrences={c.occurrences} kind="drain" />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-[2rem] border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-primary">
          <Trophy size={18} weight="fill" />
          <p className="text-sm font-bold">Personal records</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <RecordChip icon={<Trophy size={18} weight="fill" />} label="Best score" value={String(records.bestScore)} />
          <RecordChip icon={<Fire size={18} weight="fill" />} label="Longest streak" value={`${records.longestStreak}d`} />
          <RecordChip icon={<Sparkle size={18} weight="fill" />} label="Check-ins" value={String(records.totalCheckIns)} />
          {records.bestDayOfWeek && (
            <RecordChip icon={<CalendarBlank size={18} weight="fill" />} label="Best day" value={records.bestDayOfWeek} />
          )}
        </div>
      </section>
    </div>
  )
}
