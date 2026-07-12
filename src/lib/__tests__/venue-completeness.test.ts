import { describe, it, expect } from 'vitest'
import { scoreVenueCompleteness } from '../venue-completeness'
import type { Venue } from '../types'

const baseVenue: Venue = {
  id: 'v1',
  name: 'Neon Room',
  location: { lat: 47.61, lng: -122.32, address: '1 Pike St' },
  city: 'Seattle',
  state: 'WA',
  category: 'Bar',
  categoryKey: 'bar',
  neighborhood: 'Capitol Hill',
  pulseScore: 70,
  hours: { friday: '9 PM - 2 AM' },
  phone: '206-555-0100',
  website: 'https://example.com',
  dressCode: 'casual',
  coverChargeCents: 1000,
  accessibilityFeatures: ['wheelchair_accessible'],
  priceRange: 2,
  integrations: { maps: { googleMapsUrl: 'https://maps.google.com' } },
}

describe('scoreVenueCompleteness', () => {
  it('scores a fully enriched venue highly', () => {
    const result = scoreVenueCompleteness(baseVenue)
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.missing).not.toContain('hours')
    expect(result.missing).not.toContain('neighborhood')
  })

  it('flags missing critical fields', () => {
    const sparse: Venue = {
      id: 'v2',
      name: 'Sparse',
      location: { lat: 47.61, lng: -122.32, address: '' },
      pulseScore: 0,
    }
    const result = scoreVenueCompleteness(sparse)
    expect(result.missing).toContain('hours')
    expect(result.score).toBeLessThan(40)
  })
})
