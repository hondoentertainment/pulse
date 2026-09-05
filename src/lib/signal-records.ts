import type { SignalEntry } from '@/lib/signal-insights'
import { localDayKey, parseDayKey, shiftDayKey } from '@/lib/signal-windows'

/**
 * Personal records and best day of the week. Pure functions over the entry
 * list; the UI gates on `MIN_ENTRIES_FOR_RECORDS` so nothing here is shown
 * on thin data.
 */

export const MIN_ENTRIES_FOR_RECORDS = 7
/** A weekday needs this many check-ins before it can be called the best. */
export const MIN_PER_WEEKDAY = 2

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export interface BestScore {
  score: number
  dayKey: string
}

export interface BestWeekday {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number
  label: string
  averageScore: number
  count: number
}

export interface PersonalRecords {
  totalCheckIns: number
  daysLogged: number
  bestScore: BestScore | null
  longestStreak: number
  bestWeekday: BestWeekday | null
}

const dayKeyOf = (entry: SignalEntry): string => entry.dayKey ?? localDayKey(new Date(entry.createdAt))

export function uniqueDayKeys(entries: SignalEntry[]): string[] {
  return [...new Set(entries.map(dayKeyOf))].sort()
}

export function longestStreak(entries: SignalEntry[]): number {
  const days = uniqueDayKeys(entries)
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const key of days) {
    run = previous !== null && shiftDayKey(previous, 1) === key ? run + 1 : 1
    best = Math.max(best, run)
    previous = key
  }
  return best
}

export function bestScore(entries: SignalEntry[]): BestScore | null {
  let best: BestScore | null = null
  for (const entry of entries) {
    const key = dayKeyOf(entry)
    if (best === null || entry.score > best.score || (entry.score === best.score && key > best.dayKey)) {
      best = { score: entry.score, dayKey: key }
    }
  }
  return best
}

export function bestWeekday(entries: SignalEntry[], minPerWeekday: number = MIN_PER_WEEKDAY): BestWeekday | null {
  const buckets = new Map<number, { total: number; count: number }>()
  for (const entry of entries) {
    const weekday = parseDayKey(dayKeyOf(entry)).getDay()
    const bucket = buckets.get(weekday) ?? { total: 0, count: 0 }
    bucket.total += entry.score
    bucket.count += 1
    buckets.set(weekday, bucket)
  }

  let best: BestWeekday | null = null
  for (const [weekday, bucket] of buckets) {
    if (bucket.count < minPerWeekday) continue
    const averageScore = Math.round(bucket.total / bucket.count)
    if (
      best === null ||
      averageScore > best.averageScore ||
      (averageScore === best.averageScore && bucket.count > best.count)
    ) {
      best = { weekday, label: WEEKDAY_LABELS[weekday], averageScore, count: bucket.count }
    }
  }
  return best
}

export function personalRecords(entries: SignalEntry[]): PersonalRecords {
  return {
    totalCheckIns: entries.length,
    daysLogged: uniqueDayKeys(entries).length,
    bestScore: bestScore(entries),
    longestStreak: longestStreak(entries),
    bestWeekday: bestWeekday(entries),
  }
}

export function recordsCopy(records: PersonalRecords): string {
  if (records.bestWeekday && records.bestScore) {
    return `${records.bestWeekday.label}s run strongest at ${records.bestWeekday.averageScore}. Your best single signal was ${records.bestScore.score}.`
  }
  if (records.bestScore) {
    return `Your best single signal was ${records.bestScore.score}. A few more weeks will reveal your best day.`
  }
  return 'Your records will appear after your first check-in.'
}
