import { describe, it, expect } from 'vitest'
import {
  calculateDistance,
  isWithinRadius,
  calculatePulseScore,
  getEnergyLabel,
  getEnergyColor,
  formatTimeAgo,
  canPostPulse,
  getVenuesByProximity
} from '../pulse-engine'
import type { Pulse, Venue } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `pulse-${Math.random()}`,
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0)
  })

  it('calculates distance between two known points', () => {
    // NYC to LA is ~2,451 miles
    const dist = calculateDistance(40.7128, -74.006, 34.0522, -118.2437)
    expect(dist).toBeGreaterThan(2400)
    expect(dist).toBeLessThan(2500)
  })

  it('returns a positive value regardless of direction', () => {
    const d1 = calculateDistance(40, -74, 41, -75)
    const d2 = calculateDistance(41, -75, 40, -74)
    expect(d1).toBeCloseTo(d2, 5)
  })
})

describe('isWithinRadius', () => {
  it('returns true for same location', () => {
    expect(isWithinRadius(40, -74, 40, -74, 1)).toBe(true)
  })

  it('returns false when distance exceeds radius', () => {
    expect(isWithinRadius(40.7128, -74.006, 34.0522, -118.2437, 100)).toBe(false)
  })

  it('returns true when within radius', () => {
    // Two points ~0.03 miles apart
    expect(isWithinRadius(40.7128, -74.006, 40.7129, -74.0061, 1)).toBe(true)
  })
})

describe('calculatePulseScore', () => {
  it('returns 0 for empty pulses', () => {
    expect(calculatePulseScore([])).toBe(0)
  })

  it('returns 0 for expired pulses', () => {
    const oldPulse = makePulse({
      createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 120 min ago (past 90 min decay)
    })
    expect(calculatePulseScore([oldPulse])).toBe(0)
  })

  it('returns a score for a recent pulse', () => {
    const pulse = makePulse({ createdAt: new Date().toISOString() })
    const score = calculatePulseScore([pulse])
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('higher energy rating produces higher score', () => {
    const chillPulse = makePulse({ energyRating: 'chill' })
    const electricPulse = makePulse({ energyRating: 'electric' })
    expect(calculatePulseScore([electricPulse])).toBeGreaterThan(
      calculatePulseScore([chillPulse])
    )
  })

  it('dead energy contributes zero', () => {
    const pulse = makePulse({ energyRating: 'dead' })
    expect(calculatePulseScore([pulse])).toBe(0)
  })

  it('more pulses increase the score', () => {
    const one = [makePulse()]
    const three = [makePulse(), makePulse(), makePulse()]
    expect(calculatePulseScore(three)).toBeGreaterThan(calculatePulseScore(one))
  })

  it('caps at 100', () => {
    const many = Array.from({ length: 20 }, () =>
      makePulse({ energyRating: 'electric', reactions: { fire: ['a', 'b', 'c'], eyes: [], skull: [], lightning: ['d'] }, views: 50 })
    )
    expect(calculatePulseScore(many)).toBeLessThanOrEqual(100)
  })

  it('applies credibility weighting', () => {
    const highCred = makePulse({ credibilityWeight: 2.0 })
    const lowCred = makePulse({ credibilityWeight: 0.5 })
    expect(calculatePulseScore([highCred])).toBeGreaterThan(
      calculatePulseScore([lowCred])
    )
  })
})

describe('getEnergyLabel', () => {
  it('returns correct labels for score thresholds', () => {
    expect(getEnergyLabel(0)).toBe('Dead')
    expect(getEnergyLabel(24)).toBe('Dead')
    expect(getEnergyLabel(25)).toBe('Chill')
    expect(getEnergyLabel(49)).toBe('Chill')
    expect(getEnergyLabel(50)).toBe('Buzzing')
    expect(getEnergyLabel(74)).toBe('Buzzing')
    expect(getEnergyLabel(75)).toBe('Electric')
    expect(getEnergyLabel(100)).toBe('Electric')
  })
})

describe('getEnergyColor', () => {
  it('returns different colors for each tier', () => {
    const dead = getEnergyColor(0)
    const chill = getEnergyColor(30)
    const buzzing = getEnergyColor(60)
    const electric = getEnergyColor(80)
    expect(new Set([dead, chill, buzzing, electric]).size).toBe(4)
  })
})

describe('formatTimeAgo', () => {
  it('returns "Just now" for recent dates', () => {
    expect(formatTimeAgo(new Date().toISOString())).toBe('Just now')
  })

  it('returns minutes for <60m', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours for <24h', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago')
  })

  it('returns days for >24h', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago')
  })
})

describe('canPostPulse', () => {
  it('allows posting with no prior pulses', () => {
    const result = canPostPulse('venue-1', [], 120)
    expect(result.canPost).toBe(true)
  })

  it('blocks posting within cooldown', () => {
    const recentPulse = makePulse({
      venueId: 'venue-1',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    })
    const result = canPostPulse('venue-1', [recentPulse], 120)
    expect(result.canPost).toBe(false)
    expect(result.remainingMinutes).toBeGreaterThan(0)
    expect(result.remainingMinutes).toBeLessThanOrEqual(90)
  })

  it('allows posting after cooldown expires', () => {
    const oldPulse = makePulse({
      venueId: 'venue-1',
      createdAt: new Date(Date.now() - 150 * 60 * 1000).toISOString(), // 150 min ago
    })
    const result = canPostPulse('venue-1', [oldPulse], 120)
    expect(result.canPost).toBe(true)
  })

  it('only checks pulses for the target venue', () => {
    const otherVenuePulse = makePulse({
      venueId: 'venue-2',
      createdAt: new Date().toISOString(),
    })
    const result = canPostPulse('venue-1', [otherVenuePulse], 120)
    expect(result.canPost).toBe(true)
  })
})

describe('getVenuesByProximity', () => {
  const venues: Venue[] = [
    { id: 'far', name: 'Far', location: { lat: 41, lng: -75, address: '' }, pulseScore: 0 },
    { id: 'near', name: 'Near', location: { lat: 40.7129, lng: -74.0061, address: '' }, pulseScore: 0 },
  ]

  it('sorts venues by distance from user', () => {
    const sorted = getVenuesByProximity(venues, 40.7128, -74.006)
    expect(sorted[0].id).toBe('near')
    expect(sorted[1].id).toBe('far')
  })

  it('returns all venues', () => {
    const sorted = getVenuesByProximity(venues, 40.7128, -74.006)
    expect(sorted.length).toBe(2)
  })
})
