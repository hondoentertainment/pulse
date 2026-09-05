import { describe, expect, it } from 'vitest'
import { bestScore, bestWeekday, longestStreak, personalRecords, recordsCopy } from '@/lib/signal-records'
import type { SignalEntry } from '@/lib/signal-insights'

const entry = (overrides: Partial<SignalEntry> & { dayKey: string }): SignalEntry => ({
  id: overrides.id ?? `${overrides.dayKey}-${overrides.window ?? 'morning'}`,
  userId: 'user-1',
  createdAt: overrides.createdAt ?? `${overrides.dayKey}T08:00:00`,
  focus: 'energy',
  score: overrides.score ?? 70,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: 7,
  tags: overrides.tags ?? [],
  window: overrides.window ?? 'morning',
  dayKey: overrides.dayKey,
})

describe('longestStreak', () => {
  it('finds the longest run of consecutive days, not just the current one', () => {
    const streak = longestStreak([
      entry({ dayKey: '2026-08-01' }),
      entry({ dayKey: '2026-08-02' }),
      entry({ dayKey: '2026-08-03' }),
      entry({ dayKey: '2026-08-03', window: 'evening' }),
      // gap
      entry({ dayKey: '2026-08-10' }),
      entry({ dayKey: '2026-08-11' }),
    ])
    expect(streak).toBe(3)
  })

  it('is zero with no entries and one with a single day', () => {
    expect(longestStreak([])).toBe(0)
    expect(longestStreak([entry({ dayKey: '2026-08-01' })])).toBe(1)
  })

  it('counts across a month boundary', () => {
    expect(longestStreak([entry({ dayKey: '2026-08-31' }), entry({ dayKey: '2026-09-01' })])).toBe(2)
  })
})

describe('bestScore', () => {
  it('returns the highest score and its day, preferring the most recent tie', () => {
    expect(
      bestScore([
        entry({ dayKey: '2026-08-01', score: 90 }),
        entry({ dayKey: '2026-08-05', score: 90 }),
        entry({ dayKey: '2026-08-03', score: 70 }),
      ]),
    ).toEqual({ score: 90, dayKey: '2026-08-05' })
    expect(bestScore([])).toBeNull()
  })
})

describe('bestWeekday', () => {
  it('needs at least two check-ins on a weekday before naming it', () => {
    // 2026-08-03 is a Monday, 2026-08-04 a Tuesday.
    const single = bestWeekday([entry({ dayKey: '2026-08-03', score: 95 }), entry({ dayKey: '2026-08-04', score: 50 })])
    expect(single).toBeNull()
  })

  it('picks the weekday with the highest average', () => {
    const best = bestWeekday([
      entry({ dayKey: '2026-08-03', score: 80 }), // Mon
      entry({ dayKey: '2026-08-10', score: 84 }), // Mon
      entry({ dayKey: '2026-08-04', score: 50 }), // Tue
      entry({ dayKey: '2026-08-11', score: 54 }), // Tue
    ])
    expect(best).toEqual({ weekday: 1, label: 'Monday', averageScore: 82, count: 2 })
  })
})

describe('personalRecords', () => {
  it('bundles the records and writes honest copy', () => {
    const records = personalRecords([
      entry({ dayKey: '2026-08-03', score: 80 }),
      entry({ dayKey: '2026-08-04', score: 60 }),
      entry({ dayKey: '2026-08-10', score: 88 }),
      entry({ dayKey: '2026-08-11', score: 62 }),
    ])
    expect(records.totalCheckIns).toBe(4)
    expect(records.daysLogged).toBe(4)
    expect(records.longestStreak).toBe(2)
    expect(records.bestScore).toEqual({ score: 88, dayKey: '2026-08-10' })
    expect(records.bestWeekday?.label).toBe('Monday')
    expect(recordsCopy(records)).toMatch(/Mondays run strongest at 84\. Your best single signal was 88\./)
  })

  it('falls back when there is no qualifying weekday yet', () => {
    const records = personalRecords([entry({ dayKey: '2026-08-03', score: 77 })])
    expect(records.bestWeekday).toBeNull()
    expect(recordsCopy(records)).toMatch(/best single signal was 77/)
    expect(recordsCopy(personalRecords([]))).toMatch(/after your first check-in/)
  })
})
