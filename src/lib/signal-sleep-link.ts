import type { SignalEntry } from '@/lib/signal-insights'
import { localDayKey, shiftDayKey } from '@/lib/signal-windows'

/**
 * Sleep → next-day signal link.
 *
 * The 0–100 score already weights sleep quality, so comparing sleep with the
 * *same* day's score would be circular. Instead each day's reported sleep is
 * paired with the *following* day's mean score: "does a good night carry into
 * tomorrow?" Only consecutive days form a pair; gaps are skipped.
 */

export const GOOD_SLEEP_MIN = 7
export const POOR_SLEEP_MAX = 4
export const MIN_SLEEP_PAIRS = 5

export interface SleepLink {
  /** Consecutive-day (sleep, next-day score) pairs found. */
  pairs: number
  goodNights: number
  poorNights: number
  /** Mean next-day score after nights rated >= GOOD_SLEEP_MIN, or null. */
  afterGoodSleep: number | null
  /** Mean next-day score after nights rated <= POOR_SLEEP_MAX, or null. */
  afterPoorSleep: number | null
  /** afterGoodSleep - afterPoorSleep when both exist. */
  delta: number | null
  /** True once there are enough pairs to show the card. */
  ready: boolean
  copy: string
}

interface DayAggregate {
  sleep: number
  score: number
}

const dayKeyOf = (entry: SignalEntry): string => entry.dayKey ?? localDayKey(new Date(entry.createdAt))

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)

function aggregateByDay(entries: SignalEntry[]): Map<string, DayAggregate> {
  const buckets = new Map<string, { sleep: number[]; score: number[] }>()
  for (const entry of entries) {
    const key = dayKeyOf(entry)
    const bucket = buckets.get(key) ?? { sleep: [], score: [] }
    bucket.sleep.push(entry.sleepQuality)
    bucket.score.push(entry.score)
    buckets.set(key, bucket)
  }
  const days = new Map<string, DayAggregate>()
  for (const [key, bucket] of buckets) {
    days.set(key, {
      sleep: bucket.sleep.reduce((sum, value) => sum + value, 0) / bucket.sleep.length,
      score: bucket.score.reduce((sum, value) => sum + value, 0) / bucket.score.length,
    })
  }
  return days
}

export function analyzeSleepLink(entries: SignalEntry[]): SleepLink {
  const days = aggregateByDay(entries)
  const afterGood: number[] = []
  const afterPoor: number[] = []
  let pairs = 0

  for (const [key, today] of days) {
    const tomorrow = days.get(shiftDayKey(key, 1))
    if (!tomorrow) continue
    pairs += 1
    if (today.sleep >= GOOD_SLEEP_MIN) afterGood.push(tomorrow.score)
    else if (today.sleep <= POOR_SLEEP_MAX) afterPoor.push(tomorrow.score)
  }

  const afterGoodSleep = mean(afterGood)
  const afterPoorSleep = mean(afterPoor)
  const delta = afterGoodSleep === null || afterPoorSleep === null ? null : afterGoodSleep - afterPoorSleep
  const ready = pairs >= MIN_SLEEP_PAIRS

  return {
    pairs,
    goodNights: afterGood.length,
    poorNights: afterPoor.length,
    afterGoodSleep,
    afterPoorSleep,
    delta,
    ready,
    copy: sleepLinkCopy({ pairs, ready, afterGoodSleep, afterPoorSleep, delta }),
  }
}

function sleepLinkCopy(link: Pick<SleepLink, 'pairs' | 'ready' | 'afterGoodSleep' | 'afterPoorSleep' | 'delta'>): string {
  if (!link.ready) {
    const remaining = MIN_SLEEP_PAIRS - link.pairs
    return `Log ${remaining} more back-to-back ${remaining === 1 ? 'day' : 'days'} to see how sleep carries into tomorrow.`
  }
  if (link.delta !== null && link.afterGoodSleep !== null && link.afterPoorSleep !== null) {
    if (link.delta >= 5) {
      return `The day after a good night you average ${link.afterGoodSleep}, ${link.delta} above the day after a rough one.`
    }
    if (link.delta <= -5) {
      return `The day after a rough night you average ${link.afterPoorSleep}, ${Math.abs(link.delta)} above the day after a good one. Worth a closer look.`
    }
    return 'Sleep quality is not moving your next-day signal much yet. Keep logging both windows.'
  }
  if (link.afterGoodSleep !== null) {
    return `The day after a good night you average ${link.afterGoodSleep}. A few rougher nights will complete the comparison.`
  }
  if (link.afterPoorSleep !== null) {
    return `The day after a rough night you average ${link.afterPoorSleep}. A few good nights will complete the comparison.`
  }
  return 'Your sleep ratings sit mid-range so far. Very good or very rough nights will reveal the link.'
}
