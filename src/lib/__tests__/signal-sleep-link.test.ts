import { describe, expect, it } from 'vitest'
import { analyzeSleepLink, MIN_SLEEP_PAIRS } from '@/lib/signal-sleep-link'
import type { SignalEntry } from '@/lib/signal-insights'

const entry = (overrides: Partial<SignalEntry> & { dayKey: string }): SignalEntry => ({
  id: overrides.id ?? `${overrides.dayKey}-${overrides.window ?? 'morning'}`,
  userId: 'user-1',
  createdAt: overrides.createdAt ?? `${overrides.dayKey}T08:00:00`,
  focus: 'sleep',
  score: overrides.score ?? 70,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: overrides.sleepQuality ?? 7,
  tags: overrides.tags ?? [],
  window: overrides.window ?? 'morning',
  dayKey: overrides.dayKey,
})

describe('analyzeSleepLink', () => {
  it('is not ready and says how many more linked days are needed', () => {
    const link = analyzeSleepLink([
      entry({ dayKey: '2026-08-01', sleepQuality: 8, score: 70 }),
      entry({ dayKey: '2026-08-02', sleepQuality: 8, score: 80 }),
    ])
    expect(link.pairs).toBe(1)
    expect(link.ready).toBe(false)
    expect(link.copy).toMatch(new RegExp(`Log ${MIN_SLEEP_PAIRS - 1} more`))
  })

  it('pairs each night with the following day and compares good vs rough nights', () => {
    // Alternating: good night -> 80 next day, rough night -> 50 next day.
    const link = analyzeSleepLink([
      entry({ dayKey: '2026-08-01', sleepQuality: 8, score: 65 }),
      entry({ dayKey: '2026-08-02', sleepQuality: 3, score: 80 }),
      entry({ dayKey: '2026-08-03', sleepQuality: 8, score: 50 }),
      entry({ dayKey: '2026-08-04', sleepQuality: 3, score: 80 }),
      entry({ dayKey: '2026-08-05', sleepQuality: 8, score: 50 }),
      entry({ dayKey: '2026-08-06', sleepQuality: 3, score: 80 }),
      entry({ dayKey: '2026-08-07', sleepQuality: 5, score: 50 }),
    ])
    expect(link.pairs).toBe(6)
    expect(link.ready).toBe(true)
    expect(link.goodNights).toBe(3)
    expect(link.poorNights).toBe(3)
    expect(link.afterGoodSleep).toBe(80)
    expect(link.afterPoorSleep).toBe(50)
    expect(link.delta).toBe(30)
    expect(link.copy).toMatch(/day after a good night you average 80, 30 above/i)
  })

  it('skips gaps and averages both windows of a day', () => {
    const link = analyzeSleepLink([
      entry({ dayKey: '2026-08-01', sleepQuality: 8, score: 60 }),
      // 08-02 missing: 08-01 must not pair with 08-03
      entry({ dayKey: '2026-08-03', sleepQuality: 8, score: 60 }),
      entry({ dayKey: '2026-08-04', window: 'morning', sleepQuality: 8, score: 70 }),
      entry({ dayKey: '2026-08-04', window: 'evening', sleepQuality: 8, score: 90 }),
    ])
    expect(link.pairs).toBe(1)
    // next-day mean of 08-04 = (70 + 90) / 2
    expect(link.afterGoodSleep).toBe(80)
  })

  it('does not count mid-range nights as good or rough', () => {
    const link = analyzeSleepLink([
      entry({ dayKey: '2026-08-01', sleepQuality: 5, score: 60 }),
      entry({ dayKey: '2026-08-02', sleepQuality: 6, score: 60 }),
    ])
    expect(link.pairs).toBe(1)
    expect(link.goodNights).toBe(0)
    expect(link.poorNights).toBe(0)
    expect(link.afterGoodSleep).toBeNull()
  })

  it('crosses a month boundary when pairing days', () => {
    const link = analyzeSleepLink([
      entry({ dayKey: '2026-08-31', sleepQuality: 9, score: 50 }),
      entry({ dayKey: '2026-09-01', sleepQuality: 9, score: 90 }),
    ])
    expect(link.pairs).toBe(1)
    expect(link.afterGoodSleep).toBe(90)
  })
})
