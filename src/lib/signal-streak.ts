/**
 * Streak accounting.
 *
 * The original `getStreakCount` had two problems that punished honest users:
 *
 *   1. **It read 0 until you checked in today.** Walking back from `now`, a
 *      user with a 30-day streak saw "0" every morning until they logged —
 *      the exact moment the number is supposed to motivate them.
 *   2. **One missed day erased everything.** Streak loss is the best-documented
 *      churn trigger in habit products: the run is gone, so why come back?
 *
 * This module fixes both:
 *
 *   - **Today is "in progress"**: an unlogged today doesn't break the streak,
 *     it just isn't counted yet.
 *   - **One grace day**: a single missed day inside the run is forgiven, once.
 *     A second miss ends it — so alternating days can't farm an endless streak.
 *
 * Day keys are local, not UTC, so "yesterday" means yesterday where the user
 * actually lives.
 */
import type { SignalEntry } from '@/lib/signal-insights'

export interface StreakDetail {
  /** Consecutive days logged, counting today only once logged. */
  count: number
  /** True when a missed day was forgiven inside the current run. */
  graceUsed: boolean
  /** Whether today already has an entry. */
  todayLogged: boolean
}

const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const addDays = (date: Date, delta: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + delta)
  return next
}

/** Full streak breakdown. See module docs for the grace rules. */
export function getStreakDetail(entries: SignalEntry[], now: Date = new Date()): StreakDetail {
  const days = new Set(entries.map((entry) => localDayKey(new Date(entry.createdAt))))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayLogged = days.has(localDayKey(today))

  // An unlogged today is still in progress — start from yesterday instead of
  // reporting a broken streak.
  let cursor = todayLogged ? today : addDays(today, -1)

  let count = 0
  let graceUsed = false

  for (;;) {
    if (days.has(localDayKey(cursor))) {
      count += 1
      cursor = addDays(cursor, -1)
      continue
    }
    // Forgive exactly one gap — but only when it actually bridges to another
    // logged day. Otherwise a grace would be "spent" probing past the natural
    // end of an unbroken run and reported as if a day had been missed.
    const bridges = days.has(localDayKey(addDays(cursor, -1)))
    if (!graceUsed && count > 0 && bridges) {
      graceUsed = true
      cursor = addDays(cursor, -1)
      continue
    }
    break
  }

  return { count, graceUsed, todayLogged }
}

/** Convenience wrapper for callers that only need the number. */
export function getStreakWithGrace(entries: SignalEntry[], now: Date = new Date()): number {
  return getStreakDetail(entries, now).count
}

/**
 * Whether a given past day can still be backfilled: it must be in the past,
 * within `windowDays`, and not already logged.
 */
export function canBackfillDay(
  entries: SignalEntry[],
  day: Date,
  now: Date = new Date(),
  windowDays = 7,
): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(day.getFullYear(), day.getMonth(), day.getDate())

  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays <= 0 || diffDays > windowDays) return false

  const days = new Set(entries.map((entry) => localDayKey(new Date(entry.createdAt))))
  return !days.has(localDayKey(target))
}

/**
 * The most recent missed day worth offering to backfill, or null when the run
 * is already unbroken. Used to surface a single, low-friction "log yesterday"
 * prompt rather than a date picker nobody opens.
 */
export function getMostRecentMissedDay(
  entries: SignalEntry[],
  now: Date = new Date(),
  windowDays = 7,
): Date | null {
  if (entries.length === 0) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = new Set(entries.map((entry) => localDayKey(new Date(entry.createdAt))))

  for (let offset = 1; offset <= windowDays; offset += 1) {
    const candidate = addDays(today, -offset)
    if (!days.has(localDayKey(candidate))) return candidate
  }
  return null
}

/** Noon on the given local day — a stable timestamp for a backfilled entry. */
export function backfillTimestamp(day: Date): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0).toISOString()
}
