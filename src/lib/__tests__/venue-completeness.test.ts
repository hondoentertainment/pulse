import { describe, it, expect } from 'vitest'
import {
  scoreVenueCompleteness,
  rankVenuesByCompleteness,
  cityCompletenessSummary,
} from '../venue-completeness'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Venue',
    location: { lat: 47.6, lng: -122.3, address: '' },
    pulseScore: 50,
    ...overrides,
  }
}

const fullyPopulated: Venue = makeVenue({
  id: 'full',
  location: { lat: 47.6, lng: -122.3, address: '123 Main St' },
  category: 'Bar',
  categoryKey: 'bar',
  hours: { friday: '5:00 PM - 2:00 AM' },
  phone: '(206) 555-0100',
  website: 'https://example.com',
  dressCode: 'casual',
  coverChargeCents: 1000,
  accessibilityFeatures: ['wheelchair_accessible'],
  neighborhood: 'Capitol Hill',
  priceRange: 2,
  integrations: { maps: { googleMapsUrl: 'https://maps.google.com/?q=test' } },
})

describe('scoreVenueCompleteness', () => {
  it('scores a fully-populated venue at 100', () => {
    const result = scoreVenueCompleteness(fullyPopulated)
    expect(result.score).toBe(100)
    expect(result.missing).toHaveLength(0)
  })

  it('scores a bare-bones venue low and lists every missing field', () => {
    const bare = makeVenue({ location: { lat: 47.6, lng: -122.3, address: '' } })
    const result = scoreVenueCompleteness(bare)
    expect(result.score).toBeLessThan(50)
    expect(result.missing).toContain('address')
    expect(result.missing).toContain('hours')
    expect(result.missing).toContain('dressCode')
  })

  it('treats category as filled only for non-other canonical categories', () => {
    const withOtherCategory = makeVenue({ category: 'Laundromat' })
    const withRealCategory = makeVenue({ category: 'Bar' })
    expect(scoreVenueCompleteness(withOtherCategory).missing).toContain('category')
    expect(scoreVenueCompleteness(withRealCategory).missing).not.toContain('category')
  })

  it('treats a cover charge note alone as filling the coverCharge field', () => {
    const result = scoreVenueCompleteness(makeVenue({ coverChargeNote: 'Free before 11pm' }))
    expect(result.missing).not.toContain('coverCharge')
  })

  it('weightFilled + remaining missing weight equals weightTotal', () => {
    const result = scoreVenueCompleteness(fullyPopulated)
    expect(result.weightFilled).toBe(result.weightTotal)
  })
})

describe('rankVenuesByCompleteness', () => {
  it('sorts ascending by score by default (worst first)', () => {
    const bare = makeVenue({ id: 'bare' })
    const ranked = rankVenuesByCompleteness([fullyPopulated, bare])
    expect(ranked[0].id).toBe('bare')
    expect(ranked[1].id).toBe('full')
  })

  it('sorts descending when ascending=false', () => {
    const bare = makeVenue({ id: 'bare' })
    const ranked = rankVenuesByCompleteness([bare, fullyPopulated], false)
    expect(ranked[0].id).toBe('full')
  })

  it('does not mutate the input array', () => {
    const bare = makeVenue({ id: 'bare' })
    const input = [fullyPopulated, bare]
    rankVenuesByCompleteness(input)
    expect(input[0].id).toBe('full')
  })
})

describe('cityCompletenessSummary', () => {
  it('returns zeroed summary for an empty venue list', () => {
    expect(cityCompletenessSummary([])).toEqual({
      count: 0,
      averageScore: 0,
      pctWithHours: 0,
      pctWithDress: 0,
      pctWithAccessibility: 0,
      pctWithPriceRange: 0,
    })
  })

  it('computes aggregate percentages across venues', () => {
    const bare = makeVenue({ id: 'bare' })
    const summary = cityCompletenessSummary([fullyPopulated, bare])
    expect(summary.count).toBe(2)
    expect(summary.pctWithHours).toBe(50)
    expect(summary.pctWithDress).toBe(50)
    expect(summary.pctWithPriceRange).toBe(50)
    expect(summary.averageScore).toBeGreaterThan(0)
  })
})
