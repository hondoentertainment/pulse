import { describe, it, expect } from 'vitest'
import {
  computeFreshCoverage,
  countUserReportsThisWeek,
  getScoutQuotaProgress,
  FRESH_COVERAGE_SLA_PCT,
} from '../fresh-coverage'
import type { Pulse, Venue } from '../types'

function venue(id: string, name = id): Venue {
  return {
    id,
    name,
    location: { lat: 47.6, lng: -122.3, address: 'Seattle' },
    pulseScore: 50,
    neighborhood: 'Capitol Hill',
  }
}

function pulse(
  venueId: string,
  userId: string,
  createdAt: string,
  id = `${venueId}-${createdAt}`,
): Pulse {
  return {
    id,
    venueId,
    userId,
    energyRating: 'buzzing',
    photos: [],
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    createdAt,
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  }
}

describe('fresh-coverage', () => {
  const now = new Date('2026-07-16T04:00:00Z')

  it('computes coverage and SLA against 90-minute evidence', () => {
    const venues = [venue('a'), venue('b'), venue('c'), venue('d')]
    const pulses = [
      pulse('a', 'u1', '2026-07-16T03:30:00Z'),
      pulse('b', 'u1', '2026-07-16T03:45:00Z'),
      pulse('c', 'u1', '2026-07-15T20:00:00Z'),
    ]
    const summary = computeFreshCoverage(venues, pulses, { now })
    expect(summary.total).toBe(4)
    expect(summary.freshCount).toBe(2)
    expect(summary.coveragePct).toBe(50)
    expect(summary.meetsSla).toBe(false)
    expect(summary.slaPct).toBe(FRESH_COVERAGE_SLA_PCT)
    expect(summary.stale.map((r) => r.venueId).sort()).toEqual(['c', 'd'])
  })

  it('meets SLA at 70%+', () => {
    const venues = [venue('a'), venue('b'), venue('c'), venue('d'), venue('e'), venue('f'), venue('g'), venue('h'), venue('i'), venue('j')]
    const pulses = venues.slice(0, 7).map((v, i) =>
      pulse(v.id, 'u1', `2026-07-16T03:${String(10 + i).padStart(2, '0')}:00Z`),
    )
    const summary = computeFreshCoverage(venues, pulses, { now })
    expect(summary.freshCount).toBe(7)
    expect(summary.coveragePct).toBe(70)
    expect(summary.meetsSla).toBe(true)
  })

  it('tracks scout weekly quota progress', () => {
    const weekPulses = [
      pulse('a', 'scout-1', '2026-07-14T12:00:00Z', 'p1'),
      pulse('b', 'scout-1', '2026-07-15T12:00:00Z', 'p2'),
    ]
    const count = countUserReportsThisWeek('scout-1', weekPulses, now)
    expect(count).toBe(2)
    const progress = getScoutQuotaProgress('rookie', count)
    expect(progress?.label).toBe('2/3 scout reports this week')
    expect(progress?.canSubmit).toBe(true)
    expect(getScoutQuotaProgress('rookie', 3)?.canSubmit).toBe(false)
  })
})
