import { describe, it, expect } from 'vitest'
import type { Venue } from '../types'
import {
  type ActiveBoost,
  type BoostType,
  BOOST_CONFIGS,
  createBoost,
  isBoostActive,
  getActiveBoosts,
  calculateBoostScore,
  simulateBoostAnalytics,
  getBoostROI,
  canBoost,
  getRecommendedBoostType,
  formatBoostDuration,
  estimateReach,
  getBoostTimeRemaining,
} from '../venue-quick-boost'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'The Neon Lounge',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    pulseScore: 70,
    category: 'Nightclub',
    ...overrides,
  }
}

function makeBoost(overrides: Partial<ActiveBoost> = {}): ActiveBoost {
  const now = new Date()
  return {
    id: 'qboost-test-1',
    venueId: 'v1',
    type: 'happy_hour',
    startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
    endTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(), // 90 min from now
    status: 'active',
    impressions: 0,
    taps: 0,
    conversions: 0,
    ...overrides,
  }
}

describe('BOOST_CONFIGS', () => {
  it('has configs for all 6 boost types', () => {
    const types: BoostType[] = ['happy_hour', 'live_music', 'special_event', 'last_call', 'grand_opening', 'featured']
    for (const type of types) {
      expect(BOOST_CONFIGS[type]).toBeDefined()
      expect(BOOST_CONFIGS[type].label).toBeTruthy()
      expect(BOOST_CONFIGS[type].durationOptions.length).toBeGreaterThan(0)
      expect(BOOST_CONFIGS[type].defaultDuration).toBeGreaterThan(0)
    }
  })
})

describe('createBoost', () => {
  it('creates an immediate boost with active status', () => {
    const boost = createBoost('v1', 'happy_hour', 120)
    expect(boost.venueId).toBe('v1')
    expect(boost.type).toBe('happy_hour')
    expect(boost.status).toBe('active')
    expect(boost.impressions).toBe(0)
    expect(boost.taps).toBe(0)
    expect(boost.conversions).toBe(0)
    expect(boost.id).toMatch(/^qboost-/)
  })

  it('creates a scheduled boost when startTime is in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const boost = createBoost('v1', 'live_music', 120, future)
    expect(boost.status).toBe('scheduled')
  })

  it('creates various boost types', () => {
    const types: BoostType[] = ['happy_hour', 'live_music', 'special_event', 'last_call', 'grand_opening', 'featured']
    for (const type of types) {
      const boost = createBoost('v1', type, 60)
      expect(boost.type).toBe(type)
      expect(boost.status).toBe('active')
    }
  })

  it('sets endTime based on duration in minutes', () => {
    const boost = createBoost('v1', 'featured', 120)
    const start = new Date(boost.startTime).getTime()
    const end = new Date(boost.endTime).getTime()
    expect(end - start).toBe(120 * 60 * 1000)
  })
})

describe('isBoostActive', () => {
  it('returns true for a currently active boost', () => {
    const boost = makeBoost()
    expect(isBoostActive(boost)).toBe(true)
  })

  it('returns false for an expired boost', () => {
    const boost = makeBoost({
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    })
    expect(isBoostActive(boost)).toBe(false)
  })

  it('returns false for a scheduled boost (not yet started)', () => {
    const boost = makeBoost({
      startTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    })
    expect(isBoostActive(boost)).toBe(false)
  })

  it('respects custom currentTime parameter', () => {
    const boost = makeBoost({
      startTime: '2025-01-01T20:00:00.000Z',
      endTime: '2025-01-01T22:00:00.000Z',
    })
    expect(isBoostActive(boost, new Date('2025-01-01T21:00:00.000Z'))).toBe(true)
    expect(isBoostActive(boost, new Date('2025-01-01T23:00:00.000Z'))).toBe(false)
  })
})

describe('getActiveBoosts', () => {
  it('returns only active boosts for a venue', () => {
    const active = makeBoost({ id: 'b1', venueId: 'v1' })
    const expired = makeBoost({
      id: 'b2',
      venueId: 'v1',
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    })
    const otherVenue = makeBoost({ id: 'b3', venueId: 'v2' })

    const result = getActiveBoosts('v1', [active, expired, otherVenue])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b1')
  })

  it('excludes boosts with status expired even if time range matches', () => {
    const boost = makeBoost({ status: 'expired' })
    expect(getActiveBoosts('v1', [boost])).toHaveLength(0)
  })
})

describe('calculateBoostScore', () => {
  it('applies multiplier for happy_hour (1.3x)', () => {
    const boost = makeBoost({ type: 'happy_hour' })
    expect(calculateBoostScore(boost, 50)).toBe(65)
  })

  it('applies multiplier for grand_opening (2.0x)', () => {
    const boost = makeBoost({ type: 'grand_opening' })
    expect(calculateBoostScore(boost, 50)).toBe(100)
  })

  it('caps score at 100', () => {
    const boost = makeBoost({ type: 'grand_opening' })
    expect(calculateBoostScore(boost, 80)).toBe(100)
  })

  it('applies multiplier for each boost type', () => {
    const expectedMultipliers: Record<BoostType, number> = {
      happy_hour: 1.3,
      live_music: 1.5,
      special_event: 1.6,
      last_call: 1.2,
      grand_opening: 2.0,
      featured: 1.8,
    }
    for (const [type, multiplier] of Object.entries(expectedMultipliers)) {
      const boost = makeBoost({ type: type as BoostType })
      const expected = Math.min(100, Math.round(40 * multiplier))
      expect(calculateBoostScore(boost, 40)).toBe(expected)
    }
  })
})

describe('simulateBoostAnalytics', () => {
  it('generates positive impressions and taps', () => {
    const boost = makeBoost({ type: 'featured' })
    const analytics = simulateBoostAnalytics(boost, 70)
    expect(analytics.totalImpressions).toBeGreaterThan(0)
    expect(analytics.totalTaps).toBeGreaterThan(0)
    expect(analytics.conversionRate).toBeGreaterThanOrEqual(0)
    expect(analytics.comparedToAverage).toBeGreaterThan(0)
    expect(analytics.peakHour).toBeGreaterThanOrEqual(0)
    expect(analytics.peakHour).toBeLessThanOrEqual(23)
  })

  it('returns higher impressions for grand_opening than last_call', () => {
    const grandOpening = makeBoost({ type: 'grand_opening' })
    const lastCall = makeBoost({ type: 'last_call' })
    const goAnalytics = simulateBoostAnalytics(grandOpening, 70)
    const lcAnalytics = simulateBoostAnalytics(lastCall, 70)
    expect(goAnalytics.totalImpressions).toBeGreaterThan(lcAnalytics.totalImpressions)
  })

  it('scales with venue pulse score', () => {
    const boost = makeBoost({ type: 'featured' })
    const low = simulateBoostAnalytics(boost, 20)
    const high = simulateBoostAnalytics(boost, 80)
    expect(high.totalImpressions).toBeGreaterThan(low.totalImpressions)
  })
})

describe('getBoostROI', () => {
  it('calculates ROI from analytics and cost', () => {
    const analytics = {
      totalImpressions: 1000,
      totalTaps: 100,
      conversionRate: 25,
      comparedToAverage: 50,
      peakHour: 21,
    }
    const roi = getBoostROI(analytics, 50)
    // 100 taps * 0.25 = 25 conversions * $35 = $875 / $50 = 17.5
    expect(roi).toBe(17.5)
  })

  it('returns 0 when cost is 0', () => {
    const analytics = {
      totalImpressions: 1000,
      totalTaps: 100,
      conversionRate: 25,
      comparedToAverage: 50,
      peakHour: 21,
    }
    expect(getBoostROI(analytics, 0)).toBe(0)
  })

  it('returns 0 when cost is negative', () => {
    const analytics = {
      totalImpressions: 1000,
      totalTaps: 100,
      conversionRate: 25,
      comparedToAverage: 50,
      peakHour: 21,
    }
    expect(getBoostROI(analytics, -10)).toBe(0)
  })
})

describe('canBoost', () => {
  it('returns true when venue has no active boosts', () => {
    expect(canBoost('v1', [])).toBe(true)
  })

  it('returns true when venue has 1 active boost', () => {
    const boost = makeBoost({ venueId: 'v1' })
    expect(canBoost('v1', [boost])).toBe(true)
  })

  it('returns false when venue has 2 active boosts', () => {
    const b1 = makeBoost({ id: 'b1', venueId: 'v1' })
    const b2 = makeBoost({ id: 'b2', venueId: 'v1' })
    expect(canBoost('v1', [b1, b2])).toBe(false)
  })

  it('does not count other venues boosts', () => {
    const b1 = makeBoost({ id: 'b1', venueId: 'v2' })
    const b2 = makeBoost({ id: 'b2', venueId: 'v2' })
    expect(canBoost('v1', [b1, b2])).toBe(true)
  })

  it('does not count expired boosts toward the limit', () => {
    const b1 = makeBoost({
      id: 'b1',
      venueId: 'v1',
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    })
    const b2 = makeBoost({
      id: 'b2',
      venueId: 'v1',
      startTime: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    })
    expect(canBoost('v1', [b1, b2])).toBe(true)
  })
})

describe('getRecommendedBoostType', () => {
  const venue = makeVenue()

  it('recommends last_call during late night (22-2)', () => {
    const lateNight = new Date('2025-06-14T23:00:00')
    expect(getRecommendedBoostType(venue, lateNight, lateNight.getDay())).toBe('last_call')
  })

  it('recommends happy_hour during after-work (16-19)', () => {
    const afterWork = new Date('2025-06-12T17:00:00')
    expect(getRecommendedBoostType(venue, afterWork, afterWork.getDay())).toBe('happy_hour')
  })

  it('recommends live_music for music venues in evening', () => {
    const musicVenue = makeVenue({ category: 'Music Venue' })
    const evening = new Date('2025-06-12T20:00:00')
    expect(getRecommendedBoostType(musicVenue, evening, evening.getDay())).toBe('live_music')
  })

  it('recommends special_event on weekend evenings', () => {
    const satEvening = new Date('2025-06-14T20:00:00') // Saturday
    expect(getRecommendedBoostType(venue, satEvening, 6)).toBe('special_event')
  })

  it('recommends grand_opening for low-score venues', () => {
    const newVenue = makeVenue({ pulseScore: 10 })
    const afternoon = new Date('2025-06-12T14:00:00')
    expect(getRecommendedBoostType(newVenue, afternoon, afternoon.getDay())).toBe('grand_opening')
  })

  it('defaults to featured when no specific condition matches', () => {
    const midday = new Date('2025-06-12T12:00:00')
    expect(getRecommendedBoostType(venue, midday, midday.getDay())).toBe('featured')
  })
})

describe('formatBoostDuration', () => {
  it('formats minutes under an hour', () => {
    expect(formatBoostDuration(30)).toBe('30 minutes')
    expect(formatBoostDuration(45)).toBe('45 minutes')
  })

  it('formats exact hours', () => {
    expect(formatBoostDuration(60)).toBe('1 hour')
    expect(formatBoostDuration(120)).toBe('2 hours')
    expect(formatBoostDuration(240)).toBe('4 hours')
  })

  it('formats hours and minutes', () => {
    expect(formatBoostDuration(90)).toBe('1 hour 30 min')
    expect(formatBoostDuration(150)).toBe('2 hours 30 min')
  })
})

describe('estimateReach', () => {
  it('returns positive reach for all types', () => {
    const types: BoostType[] = ['happy_hour', 'live_music', 'special_event', 'last_call', 'grand_opening', 'featured']
    for (const type of types) {
      const reach = estimateReach(type, 60, 50)
      expect(reach).toBeGreaterThan(0)
    }
  })

  it('increases with duration', () => {
    const short = estimateReach('featured', 30, 50)
    const long = estimateReach('featured', 240, 50)
    expect(long).toBeGreaterThan(short)
  })

  it('increases with venue score', () => {
    const low = estimateReach('featured', 60, 20)
    const high = estimateReach('featured', 60, 80)
    expect(high).toBeGreaterThan(low)
  })
})

describe('getBoostTimeRemaining', () => {
  it('returns positive time for an active boost', () => {
    const boost = makeBoost()
    expect(getBoostTimeRemaining(boost)).toBeGreaterThan(0)
  })

  it('returns 0 for an expired boost', () => {
    const boost = makeBoost({
      endTime: new Date(Date.now() - 60 * 1000).toISOString(),
    })
    expect(getBoostTimeRemaining(boost)).toBe(0)
  })
})

describe('boost cancellation (status change)', () => {
  it('a boost with status expired is excluded from active boosts', () => {
    const boost = makeBoost({ status: 'expired' })
    const active = getActiveBoosts('v1', [boost])
    expect(active).toHaveLength(0)
  })

  it('cancelled boost frees up capacity for new boosts', () => {
    const b1 = makeBoost({ id: 'b1', venueId: 'v1' })
    const b2 = makeBoost({ id: 'b2', venueId: 'v1', status: 'expired' })
    expect(canBoost('v1', [b1, b2])).toBe(true)
  })
})
