import { describe, expect, it } from 'vitest'
import { analyzeTagPatterns, buildWeeklySummary, tagPatternCopy } from '@/lib/signal-patterns'
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
