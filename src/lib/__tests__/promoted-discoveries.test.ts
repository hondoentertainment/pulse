import { describe, it, expect } from 'vitest'
import {
  createPromotedVenue,
  createPromotedEvent,
  createVenueBoost,
  recordImpression,
  recordClick,
  recordConversion,
  getCampaignMetrics,
  isPromotionActive,
  getActivePromotions,
  applyBoostToScore,
  sortWithPromotions,
} from '../promoted-discoveries'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return { id: 'v1', name: 'Bar A', location: { lat: 40.7, lng: -74.0, address: '' }, pulseScore: 70, ...overrides }
}

describe('createPromotedVenue', () => {
  it('creates a promotion', () => {
    const promo = createPromotedVenue('v1', 'Summer Promo', 500, 'cpc', 0.5, 30)
    expect(promo.venueId).toBe('v1')
    expect(promo.budget).toBe(500)
    expect(promo.spent).toBe(0)
    expect(promo.active).toBe(true)
    expect(promo.label).toBe('Sponsored')
  })
})

describe('createPromotedEvent', () => {
  it('creates event promotion', () => {
    const pe = createPromotedEvent('e1', 'v1', 200, 'cpm', 5)
    expect(pe.eventId).toBe('e1')
    expect(pe.impressions).toBe(0)
  })
})

describe('createVenueBoost', () => {
  it('creates a boost', () => {
    const boost = createVenueBoost('v1', 1.5, 4, 100)
    expect(boost.boostMultiplier).toBe(1.5)
    expect(boost.active).toBe(true)
  })
})

describe('recordImpression / recordClick / recordConversion', () => {
  it('tracks impressions with CPM billing', () => {
    const promo = createPromotedVenue('v1', 'Test', 100, 'cpm', 10, 7)
    const updated = recordImpression(promo)
    expect(updated.impressions).toBe(1)
    expect(updated.spent).toBe(0.01)
  })

  it('tracks clicks with CPC billing', () => {
    const promo = createPromotedVenue('v1', 'Test', 100, 'cpc', 0.5, 7)
    const updated = recordClick(promo)
    expect(updated.clicks).toBe(1)
    expect(updated.spent).toBe(0.5)
  })

  it('tracks conversions with CPP billing', () => {
    const promo = createPromotedVenue('v1', 'Test', 100, 'cpp', 2, 7)
    const updated = recordConversion(promo)
    expect(updated.conversions).toBe(1)
    expect(updated.spent).toBe(2)
  })
})

describe('getCampaignMetrics', () => {
  it('calculates metrics', () => {
    let promo = createPromotedVenue('v1', 'Test', 100, 'cpc', 0.5, 7)
    for (let i = 0; i < 100; i++) promo = recordImpression(promo)
    for (let i = 0; i < 10; i++) promo = recordClick(promo)
    for (let i = 0; i < 2; i++) promo = recordConversion(promo)
    const metrics = getCampaignMetrics(promo)
    expect(metrics.impressions).toBe(100)
    expect(metrics.clicks).toBe(10)
    expect(metrics.ctr).toBe(10)
    expect(metrics.conversions).toBe(2)
    expect(metrics.conversionRate).toBe(20)
  })
})

describe('isPromotionActive', () => {
  it('returns true for active within budget', () => {
    const promo = createPromotedVenue('v1', 'Test', 100, 'cpc', 0.5, 7)
    expect(isPromotionActive(promo)).toBe(true)
  })

  it('returns false for inactive', () => {
    expect(isPromotionActive({ active: false, budget: 100, spent: 0 })).toBe(false)
  })

  it('returns false when budget exhausted', () => {
    expect(isPromotionActive({ active: true, budget: 100, spent: 100 })).toBe(false)
  })

  it('returns false when expired', () => {
    expect(isPromotionActive({ active: true, budget: 100, spent: 0, endDate: new Date(Date.now() - 86400000).toISOString() })).toBe(false)
  })
})

describe('getActivePromotions', () => {
  it('filters active promotions', () => {
    const promos = [
      createPromotedVenue('v1', 'A', 100, 'cpc', 0.5, 7),
      { ...createPromotedVenue('v2', 'B', 100, 'cpc', 0.5, 7), active: false },
    ]
    expect(getActivePromotions(promos)).toHaveLength(1)
  })
})

describe('applyBoostToScore', () => {
  it('applies boost multiplier', () => {
    const boost = createVenueBoost('v1', 1.5, 4, 100)
    const boosted = applyBoostToScore(60, [boost])
    expect(boosted).toBe(90)
  })

  it('caps at 100', () => {
    const boost = createVenueBoost('v1', 2, 4, 100)
    const boosted = applyBoostToScore(80, [boost])
    expect(boosted).toBe(100)
  })

  it('returns base with no active boosts', () => {
    expect(applyBoostToScore(60, [])).toBe(60)
  })
})

describe('sortWithPromotions', () => {
  it('inserts promoted venues at positions 1 and 4', () => {
    const venues = Array.from({ length: 6 }, (_, i) => makeVenue({ id: `v${i}`, name: `Venue ${i}` }))
    const promoted = new Set(['v0', 'v1'])
    const sorted = sortWithPromotions(venues, promoted)
    expect(sorted[1].id).toBe('v0')
  })
})
