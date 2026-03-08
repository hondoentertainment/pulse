import { describe, it, expect } from 'vitest'
import {
  shouldRemovePreTrending,
  calculateScoreVelocity,
  getTrendingSections,
  getPreTrendingLabel,
  shouldPruneSeededData,
  updateVenueWithCheckIn,
  TRENDING_THRESHOLDS,
} from '../venue-trending'
import type { Venue, Pulse, VenueAnalytics } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '123 Test St' },
    pulseScore: 0,
    ...overrides,
  }
}

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

describe('shouldRemovePreTrending', () => {
  it('returns false for non-pre-trending venues', () => {
    const venue = makeVenue({ preTrending: false })
    expect(shouldRemovePreTrending(venue, [])).toBe(false)
  })

  it('returns false when not enough unique users', () => {
    const venue = makeVenue({ preTrending: true })
    const pulses = [
      makePulse({ userId: 'user-1', venueId: 'venue-1' }),
      makePulse({ userId: 'user-1', venueId: 'venue-1' }),
    ]
    expect(shouldRemovePreTrending(venue, pulses)).toBe(false)
  })

  it('returns true when enough unique users exist', () => {
    const venue = makeVenue({ preTrending: true })
    const pulses = [
      makePulse({ userId: 'user-1', venueId: 'venue-1' }),
      makePulse({ userId: 'user-2', venueId: 'venue-1' }),
      makePulse({ userId: 'user-3', venueId: 'venue-1' }),
    ]
    expect(shouldRemovePreTrending(venue, pulses)).toBe(true)
  })
})

describe('calculateScoreVelocity', () => {
  it('returns 0 when no recent pulses', () => {
    const venue = makeVenue()
    expect(calculateScoreVelocity(venue, [])).toBe(0)
  })

  it('returns positive velocity when recent activity exceeds previous', () => {
    const venue = makeVenue()
    const recentPulses = [
      makePulse({ energyRating: 'electric', createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() }),
      makePulse({ energyRating: 'electric', createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() }),
    ]
    const velocity = calculateScoreVelocity(venue, recentPulses)
    expect(velocity).toBeGreaterThan(0)
  })

  it('returns negative velocity when previous period was more active', () => {
    const venue = makeVenue()
    const olderPulses = [
      makePulse({
        energyRating: 'electric',
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min ago (previous window)
      }),
      makePulse({
        energyRating: 'electric',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 min ago
      }),
    ]
    const velocity = calculateScoreVelocity(venue, olderPulses)
    expect(velocity).toBeLessThan(0)
  })
})

describe('getTrendingSections', () => {
  it('returns empty array when no venues meet criteria', () => {
    const sections = getTrendingSections([], [])
    expect(sections).toEqual([])
  })

  it('returns empty for venues with no pulses', () => {
    const venues = [makeVenue()]
    const sections = getTrendingSections(venues, [])
    expect(sections).toEqual([])
  })

  it('includes "Expected to Be Busy" for pre-trending venues with low score', () => {
    const venues = [makeVenue({ preTrending: true, pulseScore: 10 })]
    const sections = getTrendingSections(venues, [])
    expect(sections.some(s => s.title === 'Expected to Be Busy')).toBe(true)
  })

  it('does not include pre-trending venues with score >= 30 in Expected to Be Busy', () => {
    const venues = [makeVenue({ preTrending: true, pulseScore: 35 })]
    const sections = getTrendingSections(venues, [])
    const busySection = sections.find(s => s.title === 'Expected to Be Busy')
    expect(busySection).toBeUndefined()
  })

  it('includes "Trending Now" when criteria met', () => {
    const venue = makeVenue({ pulseScore: 60 })
    const now = Date.now()
    const pulses = [
      makePulse({ userId: 'u1', venueId: venue.id, createdAt: new Date(now - 1 * 60 * 1000).toISOString() }),
      makePulse({ userId: 'u2', venueId: venue.id, createdAt: new Date(now - 2 * 60 * 1000).toISOString() }),
      makePulse({ userId: 'u3', venueId: venue.id, createdAt: new Date(now - 3 * 60 * 1000).toISOString() }),
    ]
    const sections = getTrendingSections([venue], pulses)
    expect(sections.some(s => s.title === 'Trending Now')).toBe(true)
  })

  it('limits section sizes', () => {
    const venues = Array.from({ length: 10 }, (_, i) =>
      makeVenue({ id: `v-${i}`, preTrending: true, pulseScore: 5 })
    )
    const sections = getTrendingSections(venues, [])
    const busySection = sections.find(s => s.title === 'Expected to Be Busy')
    expect(busySection?.venues.length).toBeLessThanOrEqual(4)
  })
})

describe('getPreTrendingLabel', () => {
  it('returns empty string for non-pre-trending venues', () => {
    expect(getPreTrendingLabel(makeVenue({ preTrending: false }))).toBe('')
  })

  it('returns custom label if venue has one', () => {
    const venue = makeVenue({ preTrending: true, preTrendingLabel: 'Custom Label' })
    expect(getPreTrendingLabel(venue)).toBe('Custom Label')
  })

  it('returns a string for pre-trending venues without custom label', () => {
    const venue = makeVenue({ preTrending: true, category: 'food' })
    const label = getPreTrendingLabel(venue)
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })
})

describe('shouldPruneSeededData', () => {
  it('returns false when no conversion rate', () => {
    const analytics: VenueAnalytics = {
      venueId: 'v1',
      totalVerifiedCheckIns: 0,
      lastAnalyzedAt: new Date().toISOString(),
    }
    expect(shouldPruneSeededData(analytics)).toBe(false)
  })

  it('returns true for old seeded data with low conversion', () => {
    const analytics: VenueAnalytics = {
      venueId: 'v1',
      preTrendingConversionRate: 0.05,
      timeToFirstRealActivity: TRENDING_THRESHOLDS.PRE_TRENDING_CONVERSION_HOURS * 7 + 1,
      totalVerifiedCheckIns: 0,
      lastAnalyzedAt: new Date().toISOString(),
    }
    expect(shouldPruneSeededData(analytics)).toBe(true)
  })

  it('returns false for old seeded data with decent conversion', () => {
    const analytics: VenueAnalytics = {
      venueId: 'v1',
      preTrendingConversionRate: 0.5,
      timeToFirstRealActivity: TRENDING_THRESHOLDS.PRE_TRENDING_CONVERSION_HOURS * 7 + 1,
      totalVerifiedCheckIns: 2,
      lastAnalyzedAt: new Date().toISOString(),
    }
    expect(shouldPruneSeededData(analytics)).toBe(false)
  })
})

describe('updateVenueWithCheckIn', () => {
  it('increments verifiedCheckInCount', () => {
    const venue = makeVenue({ verifiedCheckInCount: 5 })
    const pulse = makePulse()
    const updated = updateVenueWithCheckIn(venue, pulse)
    expect(updated.verifiedCheckInCount).toBe(6)
  })

  it('sets firstRealCheckInAt for pre-trending venue on first check-in', () => {
    const venue = makeVenue({ preTrending: true })
    const pulse = makePulse({ createdAt: '2024-01-01T00:00:00Z' })
    const updated = updateVenueWithCheckIn(venue, pulse)
    expect(updated.firstRealCheckInAt).toBe('2024-01-01T00:00:00Z')
  })

  it('removes pre-trending flag after enough unique check-ins', () => {
    const venue = makeVenue({
      preTrending: true,
      verifiedCheckInCount: TRENDING_THRESHOLDS.MIN_UNIQUE_USERS,
    })
    const pulse = makePulse()
    const updated = updateVenueWithCheckIn(venue, pulse)
    expect(updated.preTrending).toBe(false)
  })

  it('does not remove pre-trending flag before threshold', () => {
    const venue = makeVenue({
      preTrending: true,
      verifiedCheckInCount: 1,
    })
    const pulse = makePulse()
    const updated = updateVenueWithCheckIn(venue, pulse)
    expect(updated.preTrending).toBe(true)
  })
})
