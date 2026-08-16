import { describe, expect, it } from 'vitest'
import { localDayKey, resolveCheckInWindow, windowLabel } from '@/lib/signal-windows'
import { buildChartSeries, compareMorningEvening, getOpenWindow, getStreakCount, getTodayEntries } from '@/lib/signal-insights'
import type { SignalEntry } from '@/lib/signal-insights'

const entry = (overrides: Partial<SignalEntry>): SignalEntry => ({
  id: overrides.id ?? '1',
  userId: 'user',
  createdAt: overrides.createdAt ?? '2026-08-16T08:00:00',
  focus: 'energy',
  score: overrides.score ?? 70,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: 7,
  tags: [],
  window: overrides.window,
  dayKey: overrides.dayKey,
})

describe('signal windows', () => {
  it('uses local calendar day keys', () => {
    expect(localDayKey(new Date(2026, 7, 16, 23, 30))).toBe('2026-08-16')
  })

  it('splits morning and evening at noon', () => {
    expect(resolveCheckInWindow(new Date(2026, 7, 16, 11, 59))).toBe('morning')
    expect(resolveCheckInWindow(new Date(2026, 7, 16, 12, 0))).toBe('evening')
    expect(windowLabel('evening')).toBe('Evening')
  })

  it('opens the unused current window only', () => {
    const morningNow = new Date(2026, 7, 16, 9, 0)
    const logged = [entry({ window: 'morning', dayKey: '2026-08-16', createdAt: morningNow.toISOString() })]
    expect(getOpenWindow(logged, morningNow)).toBeNull()
    expect(getOpenWindow(logged, new Date(2026, 7, 16, 19, 0))).toBe('evening')
  })

  it('counts a streak day when either window is logged', () => {
    const now = new Date(2026, 7, 16, 20, 0)
    const entries = [
      entry({ dayKey: '2026-08-16', window: 'evening', createdAt: now.toISOString() }),
      entry({ id: '2', dayKey: '2026-08-15', window: 'morning', createdAt: '2026-08-15T08:00:00' }),
    ]
    expect(getStreakCount(entries, now)).toBe(2)
    expect(getTodayEntries(entries, now)).toHaveLength(1)
  })

  it('charts the latest score when a day has two windows', () => {
    const now = new Date(2026, 7, 16, 20, 0)
    const series = buildChartSeries([
      entry({ window: 'morning', dayKey: '2026-08-16', score: 50, createdAt: '2026-08-16T08:00:00' }),
      entry({ id: '2', window: 'evening', dayKey: '2026-08-16', score: 88, createdAt: '2026-08-16T19:00:00' }),
    ], now)
    expect(series[series.length - 1]).toMatchObject({ score: 88, seeded: false })
  })

  it('compares morning and evening averages', () => {
    const comparison = compareMorningEvening([
      entry({ window: 'morning', score: 60 }),
      entry({ id: '2', window: 'evening', score: 80 }),
    ])
    expect(comparison).toEqual({ morning: 60, evening: 80, delta: 20 })
  })
})
