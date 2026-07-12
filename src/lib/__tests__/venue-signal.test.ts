import { describe, it, expect } from 'vitest'
import { computeVenueSignal, deriveSignalConfidence, deriveSignalTrend, VENUE_SIGNAL_MODEL_VERSION } from '../venue-signal'
import type { Pulse, Venue } from '../types'

const venue: Venue = {
  id: 'v1',
  name: 'Neon Room',
  location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
  city: 'Seattle',
  state: 'WA',
  category: 'Bar',
  pulseScore: 72,
}

const pulses: Pulse[] = [
  {
    id: 'p1',
    userId: 'u2',
    venueId: 'v1',
    photos: [],
    energyRating: 'chill',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 10,
    createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
  },
  {
    id: 'p2',
    userId: 'u3',
    venueId: 'v1',
    photos: [],
    energyRating: 'electric',
    reactions: { fire: ['u4'], eyes: [], skull: [], lightning: [] },
    views: 5,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 82 * 60 * 1000).toISOString(),
  },
  {
    id: 'p3',
    userId: 'u4',
    venueId: 'v1',
    photos: [],
    energyRating: 'electric',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 3,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 85 * 60 * 1000).toISOString(),
  },
]

describe('venue-signal', () => {
  it('exposes a versioned model', () => {
    const signal = computeVenueSignal(venue, pulses)
    expect(signal.modelVersion).toBe(VENUE_SIGNAL_MODEL_VERSION)
  })

  it('derives high confidence with 3 recent reports', () => {
    expect(deriveSignalConfidence(3, 14)).toBe('high')
  })

  it('detects rising trend when energy climbs', () => {
    expect(deriveSignalTrend('v1', pulses)).toBe('rising')
  })

  it('computes freshness from latest pulse', () => {
    const signal = computeVenueSignal(venue, pulses)
    expect(signal.reportCount).toBe(3)
    expect(signal.freshnessMinutes).toBeLessThanOrEqual(10)
    expect(signal.confidence).toBe('high')
  })
})
