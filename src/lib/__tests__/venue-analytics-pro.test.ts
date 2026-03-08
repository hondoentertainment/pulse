import { describe, it, expect } from 'vitest'
import {
  isFeatureAvailable,
  getCompetitorBenchmarks,
  analyzeCustomerFlow,
  recommendEventTiming,
  calculatePOSCorrelation,
  TIER_FEATURES,
} from '../venue-analytics-pro'
import type { Pulse, Venue } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1', venueId: 'v1', photos: ['img.jpg'],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return { id: 'v1', name: 'Bar A', location: { lat: 40.7, lng: -74.0, address: '' }, pulseScore: 70, ...overrides }
}

describe('isFeatureAvailable', () => {
  it('allows features for active subscription', () => {
    const sub = { venueId: 'v1', tier: 'pro' as const, startDate: '', endDate: '', active: true }
    expect(isFeatureAvailable(sub, 'competitor_benchmark')).toBe(true)
  })

  it('denies features for wrong tier', () => {
    const sub = { venueId: 'v1', tier: 'free' as const, startDate: '', endDate: '', active: true }
    expect(isFeatureAvailable(sub, 'competitor_benchmark')).toBe(false)
  })

  it('denies features for inactive', () => {
    const sub = { venueId: 'v1', tier: 'enterprise' as const, startDate: '', endDate: '', active: false }
    expect(isFeatureAvailable(sub, 'basic_stats')).toBe(false)
  })
})

describe('TIER_FEATURES', () => {
  it('enterprise has all features', () => {
    expect(TIER_FEATURES.enterprise).toContain('pos_correlation')
    expect(TIER_FEATURES.enterprise).toContain('api_access')
  })

  it('free has minimal features', () => {
    expect(TIER_FEATURES.free).toHaveLength(1)
  })
})

describe('getCompetitorBenchmarks', () => {
  it('ranks nearby venues', () => {
    const target = makeVenue({ id: 'v1', pulseScore: 80 })
    const nearby = [
      makeVenue({ id: 'v2', name: 'B', pulseScore: 60, location: { lat: 40.701, lng: -74.001, address: '' } }),
      makeVenue({ id: 'v3', name: 'C', pulseScore: 90, location: { lat: 40.702, lng: -74.002, address: '' } }),
    ]
    const benchmarks = getCompetitorBenchmarks(target, [target, ...nearby], 5)
    expect(benchmarks).toHaveLength(3)
    expect(benchmarks[0].rank).toBe(1)
    expect(benchmarks[0].score).toBe(90)
  })
})

describe('analyzeCustomerFlow', () => {
  it('tracks before/after venues', () => {
    const t = Date.now()
    const pulses = [
      makePulse({ userId: 'u1', venueId: 'v2', createdAt: new Date(t - 3600000).toISOString() }),
      makePulse({ userId: 'u1', venueId: 'v1', createdAt: new Date(t).toISOString() }),
      makePulse({ userId: 'u1', venueId: 'v3', createdAt: new Date(t + 3600000).toISOString() }),
    ]
    const flow = analyzeCustomerFlow('v1', pulses)
    expect(flow.venueId).toBe('v1')
    expect(flow.before.length).toBeGreaterThanOrEqual(1)
    expect(flow.after.length).toBeGreaterThanOrEqual(1)
  })

  it('returns empty for no flow data', () => {
    const flow = analyzeCustomerFlow('v1', [makePulse({ venueId: 'v1' })])
    expect(flow.before).toHaveLength(0)
    expect(flow.after).toHaveLength(0)
  })
})

describe('recommendEventTiming', () => {
  it('finds opportunity gaps', () => {
    const pulses: Pulse[] = []
    for (let i = 0; i < 5; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (d.getDay() || 7) + 6)
      d.setHours(20, 0, 0, 0)
      pulses.push(makePulse({ venueId: 'v1', energyRating: 'electric', createdAt: d.toISOString() }))
    }
    const recs = recommendEventTiming('v1', pulses)
    expect(Array.isArray(recs)).toBe(true)
  })
})

describe('calculatePOSCorrelation', () => {
  it('correlates revenue with pulses', () => {
    const today = new Date().toISOString().split('T')[0]
    const pulses = [
      makePulse({ venueId: 'v1', energyRating: 'electric', createdAt: `${today}T21:00:00.000Z` }),
      makePulse({ venueId: 'v1', energyRating: 'buzzing', createdAt: `${today}T22:00:00.000Z` }),
    ]
    const revenue = [{ date: today, revenue: 5000 }]
    const result = calculatePOSCorrelation('v1', pulses, revenue)
    expect(result).toHaveLength(1)
    expect(result[0].pulseCount).toBe(2)
    expect(result[0].revenuePerPulse).toBe(2500)
  })
})
