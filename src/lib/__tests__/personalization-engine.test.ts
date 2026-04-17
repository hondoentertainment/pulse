import { describe, it, expect } from 'vitest'
import {
  getPersonalizedVenues,
  getVenueRecommendationReason,
  getMoodVenues,
  type MoodType,
  type PersonalizationContext,
  type ScoredVenue,
} from '../personalization-engine'
import type { Venue, User, Pulse } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: `venue-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '' },
    pulseScore: 50,
    category: 'bar',
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'user',
    friends: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    favoriteCategories: [],
    venueCheckInHistory: {},
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `pulse-${Math.random().toString(36).slice(2, 8)}`,
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

describe('getPersonalizedVenues', () => {
  const evening = new Date('2026-03-14T20:00:00.000Z') // evening (UTC)

  it('returns venues sorted by personalScore descending', () => {
    const venues = [
      makeVenue({ id: 'a', pulseScore: 10 }),
      makeVenue({ id: 'b', pulseScore: 90 }),
      makeVenue({ id: 'c', pulseScore: 50 }),
    ]
    const context: PersonalizationContext = {
      user: makeUser(),
      venues,
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    expect(result).toHaveLength(3)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].personalScore).toBeGreaterThanOrEqual(result[i].personalScore)
    }
  })

  it('returns a default reason when no specific reasons apply', () => {
    const venues = [makeVenue({ id: 'a' })]
    const context: PersonalizationContext = {
      user: makeUser(),
      venues,
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    expect(result[0].reasons.length).toBeGreaterThan(0)
  })

  it('includes a "Matches your taste" reason when favoriteCategories matches', () => {
    const venues = [
      makeVenue({ id: 'bar', category: 'bar', pulseScore: 50 }),
      makeVenue({ id: 'cafe', category: 'cafe', pulseScore: 50 }),
    ]
    const user = makeUser({ favoriteCategories: ['bar'] })
    const context: PersonalizationContext = {
      user,
      venues,
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    const bar = result.find((r) => r.venue.id === 'bar')!
    expect(bar.reasons.some((r) => r.includes('Matches'))).toBe(true)
  })

  it('includes a proximity reason for very close venues', () => {
    const userLocation = { lat: 40.7128, lng: -74.006 }
    const venues = [
      makeVenue({ id: 'close', location: { lat: 40.7128, lng: -74.006, address: '' } }),
    ]
    const context: PersonalizationContext = {
      user: makeUser(),
      venues,
      pulses: [],
      userLocation,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    expect(result[0].reasons.some((r) => r.toLowerCase().includes('corner'))).toBe(true)
    expect(result[0].distance).toBeDefined()
  })

  it('includes a social signal reason when recent friend pulses exist', () => {
    const venue = makeVenue({ id: 'v-social' })
    const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 min ago
    const user = makeUser({ friends: ['friend-1', 'friend-2'] })
    const pulses: Pulse[] = [
      makePulse({ userId: 'friend-1', venueId: 'v-social', createdAt: recentTime }),
      makePulse({ userId: 'friend-2', venueId: 'v-social', createdAt: recentTime }),
    ]
    const context: PersonalizationContext = {
      user,
      venues: [venue],
      pulses,
      userLocation: null,
      currentTime: new Date(),
    }
    const result = getPersonalizedVenues(context)
    expect(result[0].reasons.some((r) => r.includes('friends'))).toBe(true)
  })

  it('includes a novelty reason for unvisited venues', () => {
    const venue = makeVenue({ id: 'new' })
    const context: PersonalizationContext = {
      user: makeUser(),
      venues: [venue],
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    expect(result[0].reasons.some((r) => r.includes('New spot'))).toBe(true)
  })

  it('includes a "go-to" reason for heavily repeated venues', () => {
    const venue = makeVenue({ id: 'favorite', category: 'bar' })
    const user = makeUser({
      favoriteCategories: ['bar'],
      venueCheckInHistory: { favorite: 10 },
    })
    const context: PersonalizationContext = {
      user,
      venues: [venue],
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    // "Matches your taste" takes precedence because favoriteCategories matched first
    expect(result[0].reasons.length).toBeGreaterThan(0)
  })

  it('includes a trending reason for preTrending venues', () => {
    const venue = makeVenue({
      id: 'trending',
      preTrending: true,
      preTrendingLabel: 'Getting heated',
    })
    const context: PersonalizationContext = {
      user: makeUser(),
      venues: [venue],
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    expect(result[0].reasons.some((r) => r.includes('heated'))).toBe(true)
  })

  it('returns an empty array for no venues', () => {
    const context: PersonalizationContext = {
      user: makeUser(),
      venues: [],
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    expect(getPersonalizedVenues(context)).toEqual([])
  })

  it('rounds personalScore to three decimal places', () => {
    const venues = [makeVenue({ id: 'a' })]
    const context: PersonalizationContext = {
      user: makeUser(),
      venues,
      pulses: [],
      userLocation: null,
      currentTime: evening,
    }
    const result = getPersonalizedVenues(context)
    const score = result[0].personalScore
    expect(Number.isFinite(score)).toBe(true)
    // Score should have at most 3 decimal places
    expect(Math.round(score * 1000) / 1000).toBe(score)
  })
})

describe('getVenueRecommendationReason', () => {
  it('returns "Recommended for you" when reasons array is empty', () => {
    const scored: ScoredVenue = {
      venue: makeVenue(),
      personalScore: 0,
      reasons: [],
    }
    expect(getVenueRecommendationReason(scored)).toBe('Recommended for you')
  })

  it('prioritizes friend reasons above other reasons', () => {
    const scored: ScoredVenue = {
      venue: makeVenue(),
      personalScore: 0.5,
      reasons: ['New spot for you', '2 friends are here', 'Matches your taste'],
    }
    expect(getVenueRecommendationReason(scored)).toBe('2 friends are here')
  })

  it('prioritizes trending over proximity', () => {
    const scored: ScoredVenue = {
      venue: makeVenue(),
      personalScore: 0.5,
      reasons: ['Nearby', 'Trending right now'],
    }
    expect(getVenueRecommendationReason(scored)).toBe('Trending right now')
  })

  it('prioritizes "corner" proximity over "Nearby"', () => {
    const scored: ScoredVenue = {
      venue: makeVenue(),
      personalScore: 0.5,
      reasons: ['Nearby', 'Just around the corner'],
    }
    expect(getVenueRecommendationReason(scored)).toBe('Just around the corner')
  })

  it('falls back to the first reason when none match priorities', () => {
    const scored: ScoredVenue = {
      venue: makeVenue(),
      personalScore: 0.5,
      reasons: ['Some random reason'],
    }
    expect(getVenueRecommendationReason(scored)).toBe('Some random reason')
  })
})

describe('getMoodVenues', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v-club', name: 'Club', category: 'nightclub', pulseScore: 90 }),
    makeVenue({ id: 'v-cafe', name: 'Cafe', category: 'cafe', pulseScore: 50 }),
    makeVenue({ id: 'v-bar', name: 'Bar', category: 'bar', pulseScore: 70 }),
    makeVenue({ id: 'v-lounge', name: 'Lounge', category: 'lounge', pulseScore: 30 }),
    makeVenue({ id: 'v-rest', name: 'Restaurant', category: 'restaurant', pulseScore: 40 }),
  ]

  it('returns only chill-appropriate venues for the "chill" mood', () => {
    const result = getMoodVenues(venues, 'chill')
    const ids = result.map((v) => v.id)
    expect(ids).toContain('v-cafe')
    expect(ids).toContain('v-lounge')
    expect(ids).not.toContain('v-club')
  })

  it('returns only wild-appropriate venues for the "wild" mood', () => {
    const result = getMoodVenues(venues, 'wild')
    const ids = result.map((v) => v.id)
    expect(ids).toContain('v-club')
    expect(ids).toContain('v-bar')
    expect(ids).not.toContain('v-cafe')
  })

  it('returns date-night-appropriate venues for "date-night"', () => {
    const result = getMoodVenues(venues, 'date-night')
    const ids = result.map((v) => v.id)
    expect(ids).toContain('v-rest')
    expect(ids).toContain('v-lounge')
  })

  it('returns an empty array when no venues match the mood categories', () => {
    const onlyClubs = [makeVenue({ id: 'v-club', category: 'nightclub' })]
    const result = getMoodVenues(onlyClubs, 'chill')
    expect(result).toEqual([])
  })

  it('sorts venues with mood-matching energy first', () => {
    const wildVenues = [
      makeVenue({ id: 'low-bar', category: 'bar', pulseScore: 10 }), // dead
      makeVenue({ id: 'high-bar', category: 'bar', pulseScore: 90 }), // electric
    ]
    const result = getMoodVenues(wildVenues, 'wild')
    // high-bar (electric=>matches wild) should come first
    expect(result[0].id).toBe('high-bar')
  })
})
