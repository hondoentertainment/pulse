import { describe, expect, it } from 'vitest'
import {
  analyzeTagPatterns,
  buildMonthlySummary,
  buildWeeklySummary,
  entriesInMonth,
  MIN_DAYS_FOR_MONTHLY,
  tagPatternCopy,
} from '@/lib/signal-patterns'
import type { SignalEntry } from '@/lib/signal-insights'

const entry = (overrides: Partial<SignalEntry>): SignalEntry => ({
  id: overrides.id ?? overrides.createdAt ?? 'id',
  userId: 'user-1',
  createdAt: overrides.createdAt ?? '2026-08-30T08:00:00.000Z',
  focus: 'energy',
  score: overrides.score ?? 70,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: 7,
  tags: overrides.tags ?? [],
  window: overrides.window ?? 'morning',
  dayKey: overrides.dayKey ?? '2026-08-30',
})

describe('buildWeeklySummary', () => {
  it('explains the empty week', () => {
    const summary = buildWeeklySummary([], new Date(2026, 7, 30, 10))
    expect(summary.checkInCount).toBe(0)
    expect(summary.averageScore).toBeNull()
    expect(summary.highlight).toMatch(/unlock your weekly summary/i)
  })

  it('summarizes the last seven local days', () => {
    const now = new Date(2026, 7, 30, 21)
    const summary = buildWeeklySummary([
      entry({ dayKey: '2026-08-24', createdAt: '2026-08-24T08:00:00', window: 'morning', score: 40, tags: ['tired'] }),
      entry({ dayKey: '2026-08-28', createdAt: '2026-08-28T08:00:00', window: 'morning', score: 60, tags: ['calm'] }),
      entry({ dayKey: '2026-08-28', createdAt: '2026-08-28T20:00:00', window: 'evening', score: 80, tags: ['calm'] }),
      entry({ dayKey: '2026-08-30', createdAt: '2026-08-30T08:00:00', window: 'morning', score: 70, tags: ['focus'] }),
    ], now)

    expect(summary.weekStart).toBe('2026-08-24')
    expect(summary.weekEnd).toBe('2026-08-30')
    expect(summary.checkInCount).toBe(4)
    expect(summary.morningAvg).toBe(57)
    expect(summary.eveningAvg).toBe(80)
    expect(summary.topTags[0]).toBe('calm')
    expect(summary.highlight).toMatch(/Evenings recovered/i)
  })
})

describe('analyzeTagPatterns', () => {
  it('ranks tags by distance from the overall average', () => {
    const patterns = analyzeTagPatterns([
      entry({ id: '1', score: 80, tags: ['workout'] }),
      entry({ id: '2', score: 78, tags: ['workout'] }),
      entry({ id: '3', score: 50, tags: ['late'] }),
      entry({ id: '4', score: 52, tags: ['late'] }),
    ])
    expect(patterns[0]?.tag).toBe('workout')
    expect(patterns[0]?.vsOverall).toBeGreaterThan(0)
    expect(patterns.find((item) => item.tag === 'late')?.vsOverall).toBeLessThan(0)
    expect(tagPatternCopy(patterns[0])).toMatch(/above your overall/)
  })
})

describe('buildMonthlySummary', () => {
  const now = new Date(2026, 7, 30, 21) // 30 Aug 2026

  it('is not ready on thin data and says how many days are missing', () => {
    const summary = buildMonthlySummary([entry({ dayKey: '2026-08-02', createdAt: '2026-08-02T08:00:00' })], now)
    expect(summary.label).toBe('August 2026')
    expect(summary.monthStart).toBe('2026-08-01')
    expect(summary.monthEnd).toBe('2026-08-30')
    expect(summary.daysLogged).toBe(1)
    expect(summary.ready).toBe(false)
    expect(summary.highlight).toMatch(new RegExp(`Log ${MIN_DAYS_FOR_MONTHLY - 1} more days`))
  })

  it('summarizes the calendar month and compares it with the previous one', () => {
    const summary = buildMonthlySummary(
      [
        // July: average 50
        entry({ dayKey: '2026-07-10', createdAt: '2026-07-10T08:00:00', score: 50 }),
        entry({ dayKey: '2026-07-11', createdAt: '2026-07-11T08:00:00', score: 50 }),
        // August: five days, mixed windows, average 70
        entry({ dayKey: '2026-08-01', createdAt: '2026-08-01T08:00:00', score: 60, tags: ['calm'] }),
        entry({ dayKey: '2026-08-02', createdAt: '2026-08-02T08:00:00', score: 65, tags: ['calm'] }),
        entry({ dayKey: '2026-08-02', createdAt: '2026-08-02T20:00:00', window: 'evening', score: 75, tags: ['social'] }),
        entry({ dayKey: '2026-08-10', createdAt: '2026-08-10T08:00:00', score: 70 }),
        entry({ dayKey: '2026-08-20', createdAt: '2026-08-20T08:00:00', score: 80 }),
        entry({ dayKey: '2026-08-29', createdAt: '2026-08-29T20:00:00', window: 'evening', score: 70 }),
        // September must be excluded
        entry({ dayKey: '2026-09-01', createdAt: '2026-09-01T08:00:00', score: 10 }),
      ],
      now,
    )
    expect(summary.checkInCount).toBe(6)
    expect(summary.daysLogged).toBe(5)
    expect(summary.ready).toBe(true)
    expect(summary.averageScore).toBe(70)
    expect(summary.morningCount).toBe(4)
    expect(summary.eveningCount).toBe(2)
    expect(summary.topTags[0]).toBe('calm')
    expect(summary.bestDay).toEqual({ dayKey: '2026-08-20', score: 80 })
    expect(summary.vsPreviousMonth).toBe(20)
    expect(summary.highlight).toMatch(/Up 20 on last month/)
  })

  it('returns null comparison when the previous month is empty', () => {
    const summary = buildMonthlySummary(
      Array.from({ length: 5 }, (_, index) =>
        entry({ dayKey: `2026-08-0${index + 1}`, createdAt: `2026-08-0${index + 1}T08:00:00`, score: 80 }),
      ),
      now,
    )
    expect(summary.vsPreviousMonth).toBeNull()
    expect(summary.highlight).toMatch(/All mornings this month/)
  })

  it('handles the January → December previous-month wrap', () => {
    const january = new Date(2027, 0, 15, 10)
    const summary = buildMonthlySummary(
      [
        entry({ dayKey: '2026-12-20', createdAt: '2026-12-20T08:00:00', score: 40 }),
        ...Array.from({ length: 5 }, (_, index) =>
          entry({ dayKey: `2027-01-0${index + 1}`, createdAt: `2027-01-0${index + 1}T08:00:00`, score: 60 }),
        ),
      ],
      january,
    )
    expect(summary.label).toBe('January 2027')
    expect(summary.vsPreviousMonth).toBe(20)
    expect(entriesInMonth(summary.bestDay ? [] : [], 2026, 11)).toEqual([])
  })
})
