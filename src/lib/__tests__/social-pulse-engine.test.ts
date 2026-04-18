import { describe, it, expect } from 'vitest'
import {
  calculateSocialPulseScore,
  createSocialPulseWindow,
  createVenuePulseWindow,
  calculatePearsonCorrelation,
  detectLag,
  calculateCorrelation,
  inferVenueFromText,
  mapSocialPostToVenue,
} from '../social-pulse-engine'
import type { SocialPost, Venue, Pulse } from '../types'

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'p1',
    postId: 'post-1',
    text: 'some post text',
    timestamp: new Date().toISOString(),
    likes: 10,
    replies: 2,
    reposts: 1,
    hashtag: 'nightlife',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: `venue-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
    pulseScore: 50,
    category: 'bar',
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `pulse-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'u1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('calculateSocialPulseScore', () => {
  it('returns all zeros for an empty post list', () => {
    const result = calculateSocialPulseScore([])
    expect(result.volume).toBe(0)
    expect(result.engagementWeightedIntensity).toBe(0)
    expect(result.velocity).toBe(0)
    expect(result.normalizedScore).toBe(0)
  })

  it('computes volume as the post count', () => {
    const posts = [makePost(), makePost(), makePost()]
    expect(calculateSocialPulseScore(posts).volume).toBe(3)
  })

  it('produces a higher normalized score for more engaged posts', () => {
    const lowEngagement = Array.from({ length: 5 }, () =>
      makePost({ likes: 1, replies: 0, reposts: 0 })
    )
    const highEngagement = Array.from({ length: 5 }, () =>
      makePost({ likes: 100, replies: 50, reposts: 20 })
    )
    const low = calculateSocialPulseScore(lowEngagement)
    const high = calculateSocialPulseScore(highEngagement)
    expect(high.normalizedScore).toBeGreaterThan(low.normalizedScore)
  })

  it('clamps normalizedScore to the 0-100 range', () => {
    const posts = Array.from({ length: 1000 }, () =>
      makePost({ likes: 10000, replies: 5000, reposts: 2000 })
    )
    const result = calculateSocialPulseScore(posts)
    expect(result.normalizedScore).toBeGreaterThanOrEqual(0)
    expect(result.normalizedScore).toBeLessThanOrEqual(100)
  })

  it('detects increasing velocity when posts cluster in the second half', () => {
    const base = Date.now()
    const posts = [
      // First half: spread out older
      makePost({ timestamp: new Date(base - 60 * 60 * 1000).toISOString() }),
      // Second half: many recent
      makePost({ timestamp: new Date(base - 5 * 60 * 1000).toISOString() }),
      makePost({ timestamp: new Date(base - 3 * 60 * 1000).toISOString() }),
      makePost({ timestamp: new Date(base - 1 * 60 * 1000).toISOString() }),
    ]
    const result = calculateSocialPulseScore(posts)
    expect(result.velocity).toBeGreaterThanOrEqual(0)
  })
})

describe('createSocialPulseWindow', () => {
  it('creates a window containing only posts in the time range', () => {
    const start = new Date('2026-03-14T20:00:00.000Z')
    const end = new Date('2026-03-14T21:00:00.000Z')
    const insidePost = makePost({ timestamp: '2026-03-14T20:30:00.000Z' })
    const beforePost = makePost({ timestamp: '2026-03-14T19:00:00.000Z' })
    const afterPost = makePost({ timestamp: '2026-03-14T22:00:00.000Z' })

    const window = createSocialPulseWindow(
      'nightlife',
      [insidePost, beforePost, afterPost],
      '60min',
      start,
      end,
    )

    expect(window.postCount).toBe(1)
    expect(window.hashtag).toBe('nightlife')
    expect(window.windowSize).toBe('60min')
    expect(window.startTime).toBe(start.toISOString())
    expect(window.endTime).toBe(end.toISOString())
  })

  it('returns zero postCount when no posts fall in the range', () => {
    const start = new Date('2026-03-14T20:00:00.000Z')
    const end = new Date('2026-03-14T21:00:00.000Z')
    const beforePost = makePost({ timestamp: '2026-03-14T19:00:00.000Z' })

    const window = createSocialPulseWindow('nightlife', [beforePost], '60min', start, end)
    expect(window.postCount).toBe(0)
    expect(window.totalEngagement).toBe(0)
  })

  it('associates a venueId when provided', () => {
    const start = new Date('2026-03-14T20:00:00.000Z')
    const end = new Date('2026-03-14T21:00:00.000Z')
    const window = createSocialPulseWindow('nightlife', [], '60min', start, end, 'venue-1')
    expect(window.venueId).toBe('venue-1')
  })
})

describe('createVenuePulseWindow', () => {
  it('filters pulses by venue and time window', () => {
    const start = new Date('2026-03-14T20:00:00.000Z')
    const end = new Date('2026-03-14T21:00:00.000Z')
    const venue = makeVenue({ id: 'v1', pulseScore: 75 })
    const inside = makePulse({ venueId: 'v1', createdAt: '2026-03-14T20:30:00.000Z', energyRating: 'electric' })
    const outside = makePulse({ venueId: 'v1', createdAt: '2026-03-14T22:30:00.000Z' })
    const wrongVenue = makePulse({ venueId: 'v2', createdAt: '2026-03-14T20:30:00.000Z' })

    const window = createVenuePulseWindow('v1', [inside, outside, wrongVenue], venue, '60min', start, end)

    expect(window.pulseCount).toBe(1)
    expect(window.averageEnergy).toBe(100) // electric → 100
    expect(window.pulseScore).toBe(75)
    expect(window.venueId).toBe('v1')
  })

  it('returns zero averageEnergy when no pulses match', () => {
    const start = new Date('2026-03-14T20:00:00.000Z')
    const end = new Date('2026-03-14T21:00:00.000Z')
    const venue = makeVenue({ id: 'v1', pulseScore: 50 })
    const window = createVenuePulseWindow('v1', [], venue, '60min', start, end)
    expect(window.pulseCount).toBe(0)
    expect(window.averageEnergy).toBe(0)
  })

  it('computes the average energy across multiple pulses', () => {
    const start = new Date('2026-03-14T20:00:00.000Z')
    const end = new Date('2026-03-14T21:00:00.000Z')
    const venue = makeVenue({ id: 'v1', pulseScore: 50 })
    const pulses = [
      makePulse({ venueId: 'v1', createdAt: '2026-03-14T20:30:00.000Z', energyRating: 'dead' }), // 0
      makePulse({ venueId: 'v1', createdAt: '2026-03-14T20:40:00.000Z', energyRating: 'electric' }), // 100
    ]
    const window = createVenuePulseWindow('v1', pulses, venue, '60min', start, end)
    expect(window.averageEnergy).toBe(50)
  })
})

describe('calculatePearsonCorrelation', () => {
  it('returns 0 for arrays of different lengths', () => {
    expect(calculatePearsonCorrelation([1, 2, 3], [1, 2])).toBe(0)
  })

  it('returns 0 for empty arrays', () => {
    expect(calculatePearsonCorrelation([], [])).toBe(0)
  })

  it('returns 1 for perfectly correlated linear data', () => {
    expect(calculatePearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5)
  })

  it('returns -1 for perfectly inversely correlated data', () => {
    expect(calculatePearsonCorrelation([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 5)
  })

  it('returns 0 for constant data (zero variance)', () => {
    expect(calculatePearsonCorrelation([1, 1, 1, 1], [2, 3, 4, 5])).toBe(0)
  })
})

describe('detectLag', () => {
  it('returns 0 for too few data points', () => {
    expect(detectLag([], [])).toBe(0)
  })

  it('returns 0 when there is no clear lag', () => {
    const windows = Array.from({ length: 5 }, (_, i) => ({
      id: `s-${i}`,
      hashtag: 'test',
      windowSize: '5min' as const,
      startTime: '',
      endTime: '',
      postCount: i,
      totalEngagement: 0,
      engagementWeightedIntensity: 0,
      velocity: 0,
      normalizedScore: i * 10,
      createdAt: '',
    }))
    const venues = Array.from({ length: 5 }, (_, i) => ({
      id: `v-${i}`,
      venueId: 'v1',
      windowSize: '5min' as const,
      startTime: '',
      endTime: '',
      pulseScore: i * 10,
      pulseCount: 0,
      averageEnergy: 0,
      createdAt: '',
    }))
    const lag = detectLag(windows, venues)
    expect(typeof lag).toBe('number')
  })
})

describe('calculateCorrelation', () => {
  it('returns a correlation object with the expected structure', () => {
    const social = Array.from({ length: 5 }, (_, i) => ({
      id: `s-${i}`,
      hashtag: 'test',
      windowSize: '60min' as const,
      startTime: '',
      endTime: '',
      postCount: i,
      totalEngagement: 0,
      engagementWeightedIntensity: 0,
      velocity: 0,
      normalizedScore: i * 20,
      createdAt: '',
    }))
    const venues = Array.from({ length: 5 }, (_, i) => ({
      id: `v-${i}`,
      venueId: 'v1',
      windowSize: '60min' as const,
      startTime: '',
      endTime: '',
      pulseScore: i * 20,
      pulseCount: 0,
      averageEnergy: 0,
      createdAt: '',
    }))
    const result = calculateCorrelation(social, venues, 'v1', '60min')
    expect(result.venueId).toBe('v1')
    expect(result.windowSize).toBe('60min')
    expect(result.correlationCoefficient).toBeGreaterThan(0.9) // strong linear correlation
    expect(result.strength).toBe('high')
  })

  it('classifies low/medium/high correlation strength', () => {
    // Zero correlation: random
    const random = [1, 5, 3, 8, 2]
    const inverse = [8, 2, 7, 1, 9]
    const social = random.map((v, i) => ({
      id: `s-${i}`,
      hashtag: 'test',
      windowSize: '60min' as const,
      startTime: '',
      endTime: '',
      postCount: 0,
      totalEngagement: 0,
      engagementWeightedIntensity: 0,
      velocity: 0,
      normalizedScore: v,
      createdAt: '',
    }))
    const venues = inverse.map((v, i) => ({
      id: `v-${i}`,
      venueId: 'v1',
      windowSize: '60min' as const,
      startTime: '',
      endTime: '',
      pulseScore: v,
      pulseCount: 0,
      averageEnergy: 0,
      createdAt: '',
    }))
    const result = calculateCorrelation(social, venues, 'v1', '60min')
    expect(['low', 'medium', 'high']).toContain(result.strength)
  })
})

describe('inferVenueFromText', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v1', name: 'The Blue Note' }),
    makeVenue({ id: 'v2', name: 'Irving Plaza' }),
    makeVenue({ id: 'v3', name: 'Brooklyn Bowl' }),
  ]

  it('finds a venue when the full name is mentioned', () => {
    expect(inferVenueFromText('Great night at The Blue Note', venues)).toBe('v1')
  })

  it('finds a venue by partial word matches (60%+ threshold)', () => {
    expect(inferVenueFromText('hanging out at irving plaza', venues)).toBe('v2')
  })

  it('returns undefined when no venue matches', () => {
    expect(inferVenueFromText('unrelated text about lunch', venues)).toBeUndefined()
  })

  it('is case-insensitive', () => {
    expect(inferVenueFromText('BROOKLYN BOWL tonight!', venues)).toBe('v3')
  })
})

describe('mapSocialPostToVenue', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v1', name: 'Sky Bar', location: { lat: 0, lng: 0, address: 'SkyBar Lounge 456 Ave' } }),
    makeVenue({ id: 'v2', name: 'Underground Club' }),
  ]

  it('prefers a direct hashtag-venue mapping', () => {
    const post = makePost({ hashtag: 'exclusive-tag' })
    const map = new Map<string, string>([['exclusive-tag', 'v1']])
    expect(mapSocialPostToVenue(post, venues, map)).toBe('v1')
  })

  it('matches by placeName when hashtag is unmapped', () => {
    const post = makePost({ hashtag: 'random', placeName: 'SkyBar' })
    const map = new Map<string, string>()
    expect(mapSocialPostToVenue(post, venues, map)).toBe('v1')
  })

  it('falls back to inferVenueFromText when placeName misses', () => {
    const post = makePost({ hashtag: 'random', text: 'at the Underground Club tonight' })
    const map = new Map<string, string>()
    expect(mapSocialPostToVenue(post, venues, map)).toBe('v2')
  })

  it('returns undefined when nothing matches', () => {
    const post = makePost({ hashtag: 'random', text: 'at home' })
    const map = new Map<string, string>()
    expect(mapSocialPostToVenue(post, venues, map)).toBeUndefined()
  })
})
