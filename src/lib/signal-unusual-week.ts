import type { SignalEntry } from '@/lib/signal-insights'
import { localDayKey, shiftDayKey } from '@/lib/signal-windows'

/** Trailing 7 days vs the prior 21 need this many distinct baseline days to read as honest. */
export const MIN_BASELINE_DAYS_FOR_UNUSUAL_WEEK = 14

/** Absolute average-score gap (points) that counts as unusual once the baseline is ready. */
export const UNUSUAL_WEEK_DELTA_THRESHOLD = 8

export interface UnusualWeek {
  recentAverage: number | null
  baselineAverage: number | null
  delta: number | null
  recentDays: number
  baselineDays: number
  ready: boolean
  highlight: string
}

const entryDayKey = (entry: SignalEntry): string => entry.dayKey ?? localDayKey(new Date(entry.createdAt))

function averageOf(entries: SignalEntry[]): number | null {
  if (entries.length === 0) return null
  return Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length)
}

function entriesInDayRange(
  entries: SignalEntry[],
  startKey: string,
  endKey: string,
): SignalEntry[] {
  return entries.filter((entry) => {
    const key = entryDayKey(entry)
    return key >= startKey && key <= endKey
  })
}

export function analyzeUnusualWeek(entries: SignalEntry[], now: Date = new Date()): UnusualWeek {
  const todayKey = localDayKey(now)
  const recentStart = shiftDayKey(todayKey, -6)
  const baselineEnd = shiftDayKey(todayKey, -7)
  const baselineStart = shiftDayKey(todayKey, -27)

  const recent = entriesInDayRange(entries, recentStart, todayKey)
  const baseline = entriesInDayRange(entries, baselineStart, baselineEnd)

  const recentDays = new Set(recent.map(entryDayKey)).size
  const baselineDays = new Set(baseline.map(entryDayKey)).size
  const recentAverage = averageOf(recent)
  const baselineAverage = averageOf(baseline)
  const delta =
    recentAverage === null || baselineAverage === null ? null : recentAverage - baselineAverage
  const ready = baselineDays >= MIN_BASELINE_DAYS_FOR_UNUSUAL_WEEK && recentDays >= 3

  return {
    recentAverage,
    baselineAverage,
    delta,
    recentDays,
    baselineDays,
    ready,
    highlight: unusualWeekHighlight({ ready, baselineDays, recentDays, delta, recentAverage }),
  }
}

function unusualWeekHighlight(input: {
  ready: boolean
  baselineDays: number
  recentDays: number
  delta: number | null
  recentAverage: number | null
}): string {
  if (!input.ready) {
    const remaining = Math.max(0, MIN_BASELINE_DAYS_FOR_UNUSUAL_WEEK - input.baselineDays)
    if (remaining > 0) {
      return `Keep logging — ${remaining} more baseline ${remaining === 1 ? 'day' : 'days'} unlocks the unusual-week read.`
    }
    return 'Log a few more days this week to compare against your baseline.'
  }

  if (input.delta !== null && Math.abs(input.delta) >= UNUSUAL_WEEK_DELTA_THRESHOLD) {
    return input.delta > 0
      ? `This week is running ${input.delta} above your prior 3-week baseline.`
      : `This week is running ${Math.abs(input.delta)} below your prior 3-week baseline.`
  }

  if (input.recentAverage !== null && input.recentAverage >= 75) {
    return 'A strong week, and still in line with your recent baseline.'
  }

  return 'This week sits near your usual range. Tag patterns will show what moved.'
}
