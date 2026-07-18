import { describe, it, expect } from 'vitest'
import { computeFreshCoverageFromRows } from '../fresh-coverage'

describe('api fresh-coverage', () => {
  const now = new Date('2026-07-16T04:00:00Z').getTime()

  it('marks venues fresh from recent pulses', () => {
    const summary = computeFreshCoverageFromRows(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      [
        { venue_id: 'a', created_at: '2026-07-16T03:40:00Z' },
        { venue_id: 'b', created_at: '2026-07-16T03:50:00Z' },
      ],
      now,
    )
    expect(summary.freshCount).toBe(2)
    expect(summary.coveragePct).toBeCloseTo(66.7, 0)
    expect(summary.meetsSla).toBe(false)
    expect(summary.stale[0]?.venueId).toBe('c')
  })
})
