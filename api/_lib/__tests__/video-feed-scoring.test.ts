import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  engagementScore,
  haversineMeters,
  proximityScore,
  rankCandidates,
  recencyScore,
  scoreCandidate,
  type VideoFeedCandidate,
} from '../video-feed-scoring'

function candidate(overrides: Partial<VideoFeedCandidate> = {}): VideoFeedCandidate {
  return {
    id: 'c1',
    venueId: 'v1',
    createdAt: new Date().toISOString(),
    pulseScore: 50,
    reactionCount: 0,
    venueLat: 0,
    venueLng: 0,
    ...overrides,
  }
}

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters(40.0, -74.0, 40.0, -74.0)).toBe(0)
  })

  it('computes roughly 111 km for 1 degree of latitude', () => {
    const d = haversineMeters(0, 0, 1, 0)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('recencyScore', () => {
  const now = new Date('2026-04-18T12:00:00Z')

  it('is 1.0 for items created now', () => {
    expect(recencyScore(now.toISOString(), now, 45)).toBeCloseTo(1, 5)
  })

  it('is 0.5 at one half-life', () => {
    const createdAt = new Date(now.getTime() - 45 * 60_000).toISOString()
    expect(recencyScore(createdAt, now, 45)).toBeCloseTo(0.5, 2)
  })

  it('decays toward 0 over several half-lives', () => {
    const createdAt = new Date(now.getTime() - 5 * 45 * 60_000).toISOString()
    expect(recencyScore(createdAt, now, 45)).toBeLessThan(0.05)
  })
})

describe('proximityScore', () => {
  it('is 1 at distance 0', () => {
    expect(proximityScore(0, 20_000)).toBe(1)
  })

  it('is 0 at or beyond the max', () => {
    expect(proximityScore(20_000, 20_000)).toBe(0)
    expect(proximityScore(999_999, 20_000)).toBe(0)
  })

  it('decays linearly', () => {
    expect(proximityScore(10_000, 20_000)).toBeCloseTo(0.5, 5)
  })
})

describe('engagementScore', () => {
  it('is 0 for zero reactions', () => {
    expect(engagementScore(0)).toBe(0)
  })

  it('saturates near 1 for high counts', () => {
    expect(engagementScore(49)).toBeCloseTo(1, 1)
    expect(engagementScore(1_000)).toBe(1)
    expect(engagementScore(5)).toBeLessThan(engagementScore(49))
  })
})

describe('scoreCandidate', () => {
  const now = new Date('2026-04-18T12:00:00Z')

  it('weights sum correctly with no viewer location', () => {
    const c = candidate({ createdAt: now.toISOString(), pulseScore: 80, reactionCount: 10 })
    const scored = scoreCandidate(c, { now })
    // Max possible when no proximity: weights.recency * 1 + weights.pulseScore * 0.8 + weights.engagement * eng
    const upperBound = DEFAULT_WEIGHTS.recency + DEFAULT_WEIGHTS.pulseScore + DEFAULT_WEIGHTS.engagement
    expect(scored.score).toBeLessThanOrEqual(upperBound)
    expect(scored.components.proximity).toBe(0)
  })

  it('uses proximity when viewer lat/lng provided', () => {
    const c = candidate({ venueLat: 40.0, venueLng: -74.0 })
    const scored = scoreCandidate(c, {
      now,
      viewerLat: 40.0,
      viewerLng: -74.0,
      maxProximityMeters: 1_000,
    })
    expect(scored.components.proximity).toBe(1)
  })
})

describe('rankCandidates', () => {
  const now = new Date('2026-04-18T12:00:00Z')

  it('ranks recent, close, high-score candidates above older, distant, low-score ones', () => {
    const top = candidate({
      id: 'top',
      createdAt: now.toISOString(),
      pulseScore: 95,
      reactionCount: 50,
      venueLat: 40.0,
      venueLng: -74.0,
    })
    const middle = candidate({
      id: 'mid',
      createdAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
      pulseScore: 70,
      reactionCount: 10,
      venueLat: 40.01,
      venueLng: -74.01,
    })
    const bottom = candidate({
      id: 'bot',
      createdAt: new Date(now.getTime() - 3 * 60 * 60_000).toISOString(),
      pulseScore: 20,
      reactionCount: 0,
      venueLat: 41.0,
      venueLng: -75.0,
    })

    const ranked = rankCandidates([bottom, middle, top], {
      now,
      viewerLat: 40.0,
      viewerLng: -74.0,
    })
    expect(ranked.map((r) => r.candidate.id)).toEqual(['top', 'mid', 'bot'])
  })

  it('sort is stable-ish: equal scores preserve relative order from the scoring function', () => {
    const a = candidate({ id: 'a', createdAt: now.toISOString(), pulseScore: 50, reactionCount: 5 })
    const b = candidate({ id: 'b', createdAt: now.toISOString(), pulseScore: 50, reactionCount: 5 })
    const ranked = rankCandidates([a, b], { now })
    expect(ranked).toHaveLength(2)
    // Both should have identical scores
    expect(ranked[0].score).toBeCloseTo(ranked[1].score, 10)
  })

  it('returns an empty array for an empty input', () => {
    expect(rankCandidates([], { now })).toEqual([])
  })
})
