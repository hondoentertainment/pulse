import { describe, expect, it } from 'vitest'
import { buildWeeklySummary, MIN_ENTRIES_FOR_SUMMARY } from '@/lib/signal-summary'
import type { SignalEntry } from '@/lib/signal-insights'

let seq = 0
function entry(overrides: Partial<SignalEntry> & { createdAt: string; score: number }): SignalEntry {
  seq += 1
  return {
    id: `s${seq}`,
    userId: 'u1',
    focus: 'energy',
    energy: 7,
    mood: 7,
    stress: 4,
    sleepQuality: 7,
    tags: [],
    ...overrides,
  }
}

// Anchor "now" so windows are deterministic. 2026-07-15 is a Wednesday.
const NOW = new Date('2026-07-15T12:00:00Z')

describe('buildWeeklySummary', () => {
  it('reports empty state with no entries', () => {
    const s = buildWeeklySummary([], NOW)
    expect(s.checkInCount).toBe(0)
    expect(s.averageScore).toBe(0)
    expect(s.bestDay).toBeNull()
    expect(s.topLiftTag).toBeNull()
    expect(s.deltaVsPreviousWeek).toBe(0)
    expect(s.hasEnoughData).toBe(false)
  })

  it('counts and averages only the current 7-day window', () => {
    const s = buildWeeklySummary(
      [
        entry({ createdAt: '2026-07-15T09:00:00Z', score: 80 }), // today
        entry({ createdAt: '2026-07-13T09:00:00Z', score: 60 }), // in window
        entry({ createdAt: '2026-07-10T09:00:00Z', score: 40 }), // in window (7 days ending today)
        entry({ createdAt: '2026-07-01T09:00:00Z', score: 100 }), // outside window
      ],
      NOW,
    )
    expect(s.checkInCount).toBe(3)
    expect(s.averageScore).toBe(60) // (80+60+40)/3
    expect(s.hasEnoughData).toBe(true)
  })

  it('identifies the best day by weekday label', () => {
    const s = buildWeeklySummary(
      [
        entry({ createdAt: '2026-07-15T09:00:00Z', score: 55 }),
        entry({ createdAt: '2026-07-14T09:00:00Z', score: 91 }), // Tuesday, highest
        entry({ createdAt: '2026-07-13T09:00:00Z', score: 70 }),
      ],
      NOW,
    )
    expect(s.bestDay).toEqual({ label: 'Tuesday', score: 91 })
  })

  it('computes delta vs previous week', () => {
    const s = buildWeeklySummary(
      [
        // this week avg 70
        entry({ createdAt: '2026-07-15T09:00:00Z', score: 70 }),
        entry({ createdAt: '2026-07-14T09:00:00Z', score: 70 }),
        entry({ createdAt: '2026-07-13T09:00:00Z', score: 70 }),
        // previous week avg 50
        entry({ createdAt: '2026-07-07T09:00:00Z', score: 50 }),
        entry({ createdAt: '2026-07-06T09:00:00Z', score: 50 }),
      ],
      NOW,
    )
    expect(s.deltaVsPreviousWeek).toBe(20)
  })

  it('zeroes the delta when there is no previous-week baseline', () => {
    const s = buildWeeklySummary(
      [
        entry({ createdAt: '2026-07-15T09:00:00Z', score: 70 }),
        entry({ createdAt: '2026-07-14T09:00:00Z', score: 80 }),
        entry({ createdAt: '2026-07-13T09:00:00Z', score: 90 }),
      ],
      NOW,
    )
    expect(s.deltaVsPreviousWeek).toBe(0)
  })

  it('surfaces the top lift tag for the week', () => {
    const s = buildWeeklySummary(
      [
        entry({ createdAt: '2026-07-15T09:00:00Z', score: 95, tags: ['active'] }),
        entry({ createdAt: '2026-07-14T09:00:00Z', score: 92, tags: ['active'] }),
        entry({ createdAt: '2026-07-13T09:00:00Z', score: 40, tags: ['tired'] }),
      ],
      NOW,
    )
    expect(s.topLiftTag).toBe('active')
  })

  it('requires MIN_ENTRIES_FOR_SUMMARY before flagging enough data', () => {
    const belowThreshold = Array.from({ length: MIN_ENTRIES_FOR_SUMMARY - 1 }, (_, i) =>
      entry({ createdAt: `2026-07-1${3 + i}T09:00:00Z`, score: 70 }),
    )
    expect(buildWeeklySummary(belowThreshold, NOW).hasEnoughData).toBe(false)
  })
})
