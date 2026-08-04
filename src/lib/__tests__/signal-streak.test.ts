import { describe, expect, it } from 'vitest'
import {
  getStreakDetail,
  getStreakWithGrace,
  canBackfillDay,
  getMostRecentMissedDay,
  backfillTimestamp,
} from '@/lib/signal-streak'
import type { SignalEntry } from '@/lib/signal-insights'

let seq = 0
/** Entry on a LOCAL day offset back from NOW, so tests are timezone-safe. */
function entryDaysAgo(offset: number, hour = 9): SignalEntry {
  seq += 1
  const d = new Date(2026, 7, 20 - offset, hour, 0, 0)
  return {
    id: `s${seq}`,
    userId: 'u1',
    createdAt: d.toISOString(),
    focus: 'energy',
    score: 70,
    energy: 7,
    mood: 7,
    stress: 4,
    sleepQuality: 7,
    tags: [],
  }
}

const NOW = new Date(2026, 7, 20, 10, 0, 0) // Aug 20 2026, 10:00 local

describe('getStreakDetail', () => {
  it('is zero with no entries', () => {
    expect(getStreakDetail([], NOW)).toEqual({ count: 0, graceUsed: false, todayLogged: false })
  })

  it('counts an unbroken run including today', () => {
    const entries = [entryDaysAgo(0), entryDaysAgo(1), entryDaysAgo(2)]
    const detail = getStreakDetail(entries, NOW)
    expect(detail.count).toBe(3)
    expect(detail.graceUsed).toBe(false)
    expect(detail.todayLogged).toBe(true)
  })

  it('does not zero the streak before today is logged', () => {
    // The old behaviour showed 0 all morning; yesterday-anchored is correct.
    const entries = [entryDaysAgo(1), entryDaysAgo(2), entryDaysAgo(3)]
    const detail = getStreakDetail(entries, NOW)
    expect(detail.count).toBe(3)
    expect(detail.todayLogged).toBe(false)
  })

  it('forgives a single missed day', () => {
    // logged: today, (miss day 1), day 2, day 3
    const entries = [entryDaysAgo(0), entryDaysAgo(2), entryDaysAgo(3)]
    const detail = getStreakDetail(entries, NOW)
    expect(detail.count).toBe(3)
    expect(detail.graceUsed).toBe(true)
  })

  it('breaks on a second missed day', () => {
    // logged: today, (miss 1), day 2, (miss 3), day 4 → stops after grace
    const entries = [entryDaysAgo(0), entryDaysAgo(2), entryDaysAgo(4)]
    expect(getStreakDetail(entries, NOW).count).toBe(2)
  })

  it('cannot be farmed by alternating days', () => {
    const alternating = [0, 2, 4, 6, 8, 10].map((offset) => entryDaysAgo(offset))
    // one grace only → today + day2, then the second gap ends it
    expect(getStreakDetail(alternating, NOW).count).toBe(2)
  })

  it('breaks when two days are missed before today', () => {
    const entries = [entryDaysAgo(3), entryDaysAgo(4)]
    expect(getStreakDetail(entries, NOW).count).toBe(0)
  })

  it('ignores multiple entries on the same day', () => {
    const entries = [entryDaysAgo(0, 8), entryDaysAgo(0, 20), entryDaysAgo(1)]
    expect(getStreakDetail(entries, NOW).count).toBe(2)
  })

  it('getStreakWithGrace returns just the count', () => {
    expect(getStreakWithGrace([entryDaysAgo(0)], NOW)).toBe(1)
  })
})

describe('canBackfillDay', () => {
  const yesterday = new Date(2026, 7, 19)

  it('allows an unlogged recent past day', () => {
    expect(canBackfillDay([entryDaysAgo(0)], yesterday, NOW)).toBe(true)
  })

  it('rejects a day that is already logged', () => {
    expect(canBackfillDay([entryDaysAgo(1)], yesterday, NOW)).toBe(false)
  })

  it('rejects today and the future', () => {
    expect(canBackfillDay([], new Date(2026, 7, 20), NOW)).toBe(false)
    expect(canBackfillDay([], new Date(2026, 7, 21), NOW)).toBe(false)
  })

  it('rejects days outside the window', () => {
    expect(canBackfillDay([], new Date(2026, 7, 1), NOW, 7)).toBe(false)
  })
})

describe('getMostRecentMissedDay', () => {
  it('returns null with no entries at all', () => {
    expect(getMostRecentMissedDay([], NOW)).toBeNull()
  })

  it('finds yesterday when it was missed', () => {
    const missed = getMostRecentMissedDay([entryDaysAgo(0), entryDaysAgo(2)], NOW)
    expect(missed).not.toBeNull()
    expect(missed!.getDate()).toBe(19)
  })

  it('returns null when the recent run is unbroken', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entryDaysAgo(i))
    expect(getMostRecentMissedDay(entries, NOW)).toBeNull()
  })

  it('never suggests a day before the user started logging', () => {
    // Brand-new user: only today. Yesterday is not a "gap" — it predates them.
    expect(getMostRecentMissedDay([entryDaysAgo(0)], NOW)).toBeNull()
  })

  it('does not walk past the earliest entry into fabricated history', () => {
    // Started 2 days ago, missed yesterday → that one gap is offerable...
    const entries = [entryDaysAgo(0), entryDaysAgo(2)]
    expect(getMostRecentMissedDay(entries, NOW)!.getDate()).toBe(19)
    // ...but once it is filled, nothing older should ever be suggested.
    const filled = [entryDaysAgo(0), entryDaysAgo(1), entryDaysAgo(2)]
    expect(getMostRecentMissedDay(filled, NOW)).toBeNull()
  })
})

describe('backfillTimestamp', () => {
  it('stamps local noon so the entry lands on the intended day', () => {
    const stamped = new Date(backfillTimestamp(new Date(2026, 7, 19)))
    expect(stamped.getFullYear()).toBe(2026)
    expect(stamped.getMonth()).toBe(7)
    expect(stamped.getDate()).toBe(19)
    expect(stamped.getHours()).toBe(12)
  })
})
