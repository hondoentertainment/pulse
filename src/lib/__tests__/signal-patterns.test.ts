import { describe, expect, it } from 'vitest'
import {
  getTagCorrelations,
  getSignalPatterns,
  getLongestStreak,
  getBestDayOfWeek,
  getMostFrequentTag,
  getPersonalRecords,
} from '@/lib/signal-patterns'
import type { SignalEntry } from '@/lib/signal-insights'

let idSeq = 0
function entry(overrides: Partial<SignalEntry> & { createdAt: string; score: number }): SignalEntry {
  idSeq += 1
  return {
    id: `e${idSeq}`,
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

describe('getTagCorrelations', () => {
  it('returns empty for fewer than two entries', () => {
    expect(getTagCorrelations([])).toEqual([])
    expect(getTagCorrelations([entry({ createdAt: '2026-07-01T09:00:00Z', score: 80 })])).toEqual([])
  })

  it('scores a tag by the gap between days with and without it', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 90, tags: ['active'] }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 88, tags: ['active'] }),
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 50, tags: ['tired'] }),
      entry({ createdAt: '2026-07-04T09:00:00Z', score: 54, tags: ['tired'] }),
    ]
    const correlations = getTagCorrelations(entries)
    const active = correlations.find((c) => c.tag === 'active')
    expect(active).toBeDefined()
    expect(active!.averageWith).toBe(89)
    expect(active!.averageWithout).toBe(52)
    expect(active!.delta).toBe(37)
    expect(active!.occurrences).toBe(2)
  })

  it('skips tags below the minimum occurrence threshold', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 90, tags: ['rare'] }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 60, tags: ['common'] }),
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 62, tags: ['common'] }),
    ]
    const tags = getTagCorrelations(entries, 2).map((c) => c.tag)
    expect(tags).toContain('common')
    expect(tags).not.toContain('rare')
  })

  it('skips a tag present on every entry (no baseline to contrast)', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 90, tags: ['always'] }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 70, tags: ['always'] }),
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 60, tags: ['always'] }),
    ]
    expect(getTagCorrelations(entries)).toEqual([])
  })

  it('sorts by delta descending', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 95, tags: ['great'] }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 92, tags: ['great'] }),
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 20, tags: ['bad'] }),
      entry({ createdAt: '2026-07-04T09:00:00Z', score: 25, tags: ['bad'] }),
    ]
    const deltas = getTagCorrelations(entries).map((c) => c.delta)
    expect(deltas).toEqual([...deltas].sort((a, b) => b - a))
  })
})

describe('getSignalPatterns', () => {
  it('splits lifts and drains and caps each list', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 95, tags: ['active'] }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 92, tags: ['active'] }),
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 20, tags: ['stressed'] }),
      entry({ createdAt: '2026-07-04T09:00:00Z', score: 25, tags: ['stressed'] }),
    ]
    const { lifts, drains } = getSignalPatterns(entries, 2)
    expect(lifts.map((l) => l.tag)).toContain('active')
    expect(drains.map((d) => d.tag)).toContain('stressed')
    expect(lifts.every((l) => l.delta > 0)).toBe(true)
    expect(drains.every((d) => d.delta < 0)).toBe(true)
  })
})

describe('getLongestStreak', () => {
  it('is zero with no entries', () => {
    expect(getLongestStreak([])).toBe(0)
  })

  it('counts the longest consecutive-day run, ignoring gaps and dupes', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 70 }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 71 }),
      entry({ createdAt: '2026-07-02T21:00:00Z', score: 72 }), // same day dupe
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 73 }),
      // gap on the 4th
      entry({ createdAt: '2026-07-05T09:00:00Z', score: 74 }),
    ]
    expect(getLongestStreak(entries)).toBe(3)
  })
})

describe('getMostFrequentTag / getBestDayOfWeek', () => {
  it('finds the most frequent tag', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 70, tags: ['calm', 'active'] }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 71, tags: ['calm'] }),
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 72, tags: ['active'] }),
    ]
    expect(getMostFrequentTag(entries)).toBe('calm')
  })

  it('returns null with no entries', () => {
    expect(getMostFrequentTag([])).toBeNull()
    expect(getBestDayOfWeek([])).toBeNull()
  })

  it('finds the best-averaging weekday', () => {
    // 2026-07-01 is a Wednesday; 2026-07-05 is a Sunday.
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 40 }), // Wed
      entry({ createdAt: '2026-07-05T09:00:00Z', score: 95 }), // Sun
    ]
    expect(getBestDayOfWeek(entries)).toBe('Sunday')
  })
})

describe('getPersonalRecords', () => {
  it('returns an empty record set for no entries', () => {
    const records = getPersonalRecords([])
    expect(records.totalCheckIns).toBe(0)
    expect(records.bestScore).toBe(0)
    expect(records.bestScoreDate).toBeNull()
    expect(records.longestStreak).toBe(0)
  })

  it('summarises lifetime bests', () => {
    const entries = [
      entry({ createdAt: '2026-07-01T09:00:00Z', score: 60, tags: ['calm'] }),
      entry({ createdAt: '2026-07-02T09:00:00Z', score: 88, tags: ['calm', 'active'] }),
      entry({ createdAt: '2026-07-03T09:00:00Z', score: 72, tags: ['calm'] }),
    ]
    const records = getPersonalRecords(entries)
    expect(records.totalCheckIns).toBe(3)
    expect(records.bestScore).toBe(88)
    expect(records.bestScoreDate).toBe('2026-07-02T09:00:00Z')
    expect(records.longestStreak).toBe(3)
    expect(records.mostFrequentTag).toBe('calm')
  })
})
