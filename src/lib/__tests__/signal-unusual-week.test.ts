import { describe, expect, it } from 'vitest'
import { analyzeUnusualWeek, MIN_BASELINE_DAYS_FOR_UNUSUAL_WEEK } from '@/lib/signal-unusual-week'
import type { SignalEntry } from '@/lib/signal-insights'
import { shiftDayKey } from '@/lib/signal-windows'

const entry = (dayKey: string, score: number): SignalEntry => ({
  id: `${dayKey}-${score}`,
  userId: 'user-1',
  createdAt: `${dayKey}T12:00:00.000Z`,
  focus: 'energy',
  score,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: 7,
  tags: [],
  window: 'morning',
  dayKey,
})

describe('analyzeUnusualWeek', () => {
  it('asks for more logging when the baseline is thin', () => {
    const now = new Date(2026, 8, 9, 12)
    const result = analyzeUnusualWeek([
      entry('2026-09-08', 70),
      entry('2026-09-09', 72),
    ], now)
    expect(result.ready).toBe(false)
    expect(result.highlight).toMatch(/baseline/i)
  })

  it('flags a week well above the prior 21-day baseline', () => {
    const now = new Date(2026, 8, 28, 12)
    const today = '2026-09-28'
    const entries: SignalEntry[] = []
    for (let i = 0; i < 28; i += 1) {
      const key = shiftDayKey(today, -i)
      entries.push(entry(key, i < 7 ? 82 : 60))
    }
    const result = analyzeUnusualWeek(entries, now)
    expect(result.baselineDays).toBeGreaterThanOrEqual(MIN_BASELINE_DAYS_FOR_UNUSUAL_WEEK)
    expect(result.ready).toBe(true)
    expect(result.delta).not.toBeNull()
    expect(result.delta! > 0).toBe(true)
    expect(result.highlight).toMatch(/above/i)
  })
})
