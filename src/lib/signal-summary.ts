/**
 * Weekly summary.
 *
 * Rolls the last 7 days of check-ins into a single at-a-glance recap — count,
 * average, best day, the tag that lifted the week most, and how the week moved
 * versus the previous one. Pure and deterministic so it can be unit-tested and
 * memoised.
 */
import type { SignalEntry } from '@/lib/signal-insights'
import { getSignalPatterns } from '@/lib/signal-patterns'

export interface WeeklySummary {
  /** Entries counted in the current 7-day window. */
  checkInCount: number
  /** Mean score across the current window (0 when empty). */
  averageScore: number
  /** Highest-scoring day in the window, if any. */
  bestDay: { label: string; score: number } | null
  /** Tag with the strongest positive correlation this window, if any. */
  topLiftTag: string | null
  /** averageScore(this week) − averageScore(previous week), rounded. */
  deltaVsPreviousWeek: number
  /** True once there are enough entries for the recap to be meaningful. */
  hasEnoughData: boolean
}

/** Entries whose createdAt falls within [start, end). */
function inWindow(entries: SignalEntry[], start: Date, end: Date): SignalEntry[] {
  return entries.filter((entry) => {
    const t = new Date(entry.createdAt).getTime()
    return t >= start.getTime() && t < end.getTime()
  })
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length

const startOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Minimum entries in the current window before the recap is worth showing. */
export const MIN_ENTRIES_FOR_SUMMARY = 3

/**
 * Build the current-week recap. "This week" is the 7 days ending today
 * (inclusive); "previous week" is the 7 days before that.
 */
export function buildWeeklySummary(entries: SignalEntry[], now: Date = new Date()): WeeklySummary {
  const endExclusive = new Date(startOfDay(now).getTime() + 86_400_000) // end of today
  const thisWeekStart = new Date(endExclusive.getTime() - 7 * 86_400_000)
  const prevWeekStart = new Date(thisWeekStart.getTime() - 7 * 86_400_000)

  const thisWeek = inWindow(entries, thisWeekStart, endExclusive)
  const prevWeek = inWindow(entries, prevWeekStart, thisWeekStart)

  const averageScore = Math.round(mean(thisWeek.map((e) => e.score)))
  const prevAverage = Math.round(mean(prevWeek.map((e) => e.score)))

  const best = thisWeek.reduce<SignalEntry | null>(
    (top, entry) => (top === null || entry.score > top.score ? entry : top),
    null,
  )

  const patterns = getSignalPatterns(thisWeek, 1)
  const topLiftTag = patterns.lifts[0]?.tag ?? null

  return {
    checkInCount: thisWeek.length,
    averageScore,
    bestDay: best
      ? {
          label: new Date(best.createdAt).toLocaleDateString(undefined, { weekday: 'long' }),
          score: best.score,
        }
      : null,
    topLiftTag,
    deltaVsPreviousWeek: prevWeek.length === 0 ? 0 : averageScore - prevAverage,
    hasEnoughData: thisWeek.length >= MIN_ENTRIES_FOR_SUMMARY,
  }
}
