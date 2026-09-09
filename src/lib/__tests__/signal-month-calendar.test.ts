import { describe, expect, it } from 'vitest'
import { buildMonthCalendar, dayAverageScore } from '@/lib/signal-month-calendar'
import type { SignalEntry } from '@/lib/signal-insights'

const entry = (dayKey: string, score: number, id = dayKey): SignalEntry => ({
  id,
  userId: 'user-1',
  createdAt: `${dayKey}T08:00:00.000Z`,
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

describe('dayAverageScore', () => {
  it('returns null for empty days and averages multiple windows', () => {
    expect(dayAverageScore([], '2026-09-01')).toBeNull()
    expect(dayAverageScore([
      entry('2026-09-01', 60, 'a'),
      { ...entry('2026-09-01', 80, 'b'), window: 'evening', createdAt: '2026-09-01T20:00:00.000Z' },
    ], '2026-09-01')).toBe(70)
  })
})

describe('buildMonthCalendar', () => {
  it('builds a Sunday-first grid with score colors for filled days', () => {
    const calendar = buildMonthCalendar([
      entry('2026-09-01', 30),
      entry('2026-09-02', 55),
      entry('2026-09-03', 80),
    ], 2026, 8)

    expect(calendar.label).toBe('September 2026')
    expect(calendar.cells.length % 7).toBe(0)

    const first = calendar.cells.find((cell) => cell.dayKey === '2026-09-01')
    const empty = calendar.cells.find((cell) => cell.dayKey === '2026-09-04')
    expect(first?.inMonth).toBe(true)
    expect(first?.score).toBe(30)
    expect(first?.color).toMatch(/^oklch\(/)
    expect(empty?.score).toBeNull()
    expect(empty?.color).toBeNull()
  })

  it('marks out-of-month leading cells', () => {
    const calendar = buildMonthCalendar([], 2026, 8)
    const leading = calendar.cells[0]
    expect(leading.inMonth).toBe(false)
    expect(leading.score).toBeNull()
  })
})
