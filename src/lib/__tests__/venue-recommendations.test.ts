import { describe, it, expect } from 'vitest'
import {
  buildCategoryPreferences,
  getFriendActivity,
  formatFriendActivityLabel,
  getRecommendations,
  getPersonalizedTrending,
} from '../venue-recommendations'
import type { Venue, Pulse, User } from '../types'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'testuser',
    friends: [],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Venue',
    location: { lat: 40, lng: -74, address: '' },
    pulseScore: 0,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random()}`,
    userId: 'user-1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('buildCategoryPreferences', () => {
  it('returns empty for user with no history', () => {
    const user = makeUser()
    expect(buildCategoryPreferences(user, [])).toEqual({})
  })

  it('builds preference map from check-in history', () => {
    const venues = [
      makeVenue({ id: 'v1', category: 'Bar' }),
      makeVenue({ id: 'v2', category: 'Café' }),
    ]
    const user = makeUser({ venueCheckInHistory: { v1: 8, v2: 2 } })
    const prefs = buildCategoryPreferences(user, venues)
    expect(prefs['bar']).toBe(0.8)
    expect(prefs['cafe']).toBe(0.2)
  })
})

describe('getFriendActivity', () => {
  it('returns empty when no friends', () => {
    const user = makeUser({ friends: [] })
    expect(getFriendActivity(user, [])).toEqual({})
  })

  it('counts friend pulses at venues', () => {
    const user = makeUser({ friends: ['friend-1', 'friend-2'] })
    const pulses = [
      makePulse({ userId: 'friend-1', venueId: 'v1' }),
      makePulse({ userId: 'friend-2', venueId: 'v1' }),
      makePulse({ userId: 'stranger', venueId: 'v1' }),
    ]
    const activity = getFriendActivity(user, pulses)
    expect(activity['v1'].count).toBe(2)
    expect(activity['v1'].friendIds).toContain('friend-1')
    expect(activity['v1'].friendIds).toContain('friend-2')
  })

  it('does not double-count same friend', () => {
    const user = makeUser({ friends: ['friend-1'] })
    const pulses = [
      makePulse({ userId: 'friend-1', venueId: 'v1' }),
      makePulse({ userId: 'friend-1', venueId: 'v1' }),
    ]
    const activity = getFriendActivity(user, pulses)
    expect(activity['v1'].count).toBe(1)
  })

  it('ignores old pulses', () => {
    const user = makeUser({ friends: ['friend-1'] })
    const pulses = [
      makePulse({
        userId: 'friend-1',
        venueId: 'v1',
        createdAt: new Date(Date.now() - 300 * 60 * 1000).toISOString(), // 5 hours ago
      }),
    ]
    const activity = getFriendActivity(user, pulses, 180)
    expect(activity['v1']).toBeUndefined()
  })
})

describe('formatFriendActivityLabel', () => {
  it('uses singular for 1 friend', () => {
    expect(formatFriendActivityLabel(1)).toBe('1 friend pulsed here tonight')
  })
  it('uses plural for multiple friends', () => {
    expect(formatFriendActivityLabel(3)).toBe('3 friends pulsed here tonight')
  })
})

describe('getRecommendations', () => {
  const venues = [
    makeVenue({ id: 'bar-1', category: 'Bar', pulseScore: 60, location: { lat: 40.001, lng: -74.001, address: '' } }),
    makeVenue({ id: 'cafe-1', category: 'Café', pulseScore: 30, location: { lat: 40.002, lng: -74.002, address: '' } }),
    makeVenue({ id: 'club-1', category: 'Nightclub', pulseScore: 80, location: { lat: 40.003, lng: -74.003, address: '' } }),
  ]

  it('returns recommendations sorted by score', () => {
    const user = makeUser({ venueCheckInHistory: { 'bar-1': 10 } })
    const recs = getRecommendations(user, venues, [], { lat: 40, lng: -74 })
    expect(recs.length).toBeGreaterThan(0)
    // Should be sorted descending
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score)
    }
  })

  it('includes category match reason for frequented categories', () => {
    const user = makeUser({ venueCheckInHistory: { 'bar-1': 10 } })
    const recs = getRecommendations(user, venues, [], { lat: 40, lng: -74 })
    const barRec = recs.find(r => r.venue.id === 'bar-1')
    expect(barRec?.reasons.some(r => r.type === 'category_match')).toBe(true)
  })

  it('includes friend activity reason', () => {
    const user = makeUser({ friends: ['friend-1'] })
    const pulses = [makePulse({ userId: 'friend-1', venueId: 'bar-1' })]
    const recs = getRecommendations(user, venues, pulses, { lat: 40, lng: -74 })
    const barRec = recs.find(r => r.venue.id === 'bar-1')
    expect(barRec?.reasons.some(r => r.type === 'friend_activity')).toBe(true)
  })

  it('includes trending reason for high-score venues', () => {
    const user = makeUser()
    const recs = getRecommendations(user, venues, [], { lat: 40, lng: -74 })
    const clubRec = recs.find(r => r.venue.id === 'club-1')
    expect(clubRec?.reasons.some(r => r.type === 'trending')).toBe(true)
  })

  it('gives new discovery bonus for unvisited venues', () => {
    const user = makeUser({ venueCheckInHistory: { 'bar-1': 5 } })
    const recs = getRecommendations(user, venues, [], { lat: 40, lng: -74 })
    const cafeRec = recs.find(r => r.venue.id === 'cafe-1')
    expect(cafeRec?.reasons.some(r => r.type === 'new_discovery')).toBe(true)
  })

  it('respects limit parameter', () => {
    const user = makeUser()
    const recs = getRecommendations(user, venues, [], undefined, new Date(), 2)
    expect(recs.length).toBeLessThanOrEqual(2)
  })
})

describe('getPersonalizedTrending', () => {
  it('only returns venues with pulseScore >= 30', () => {
    const venues = [
      makeVenue({ id: 'v1', pulseScore: 50 }),
      makeVenue({ id: 'v2', pulseScore: 10 }),
    ]
    const user = makeUser()
    const result = getPersonalizedTrending(user, venues, [])
    expect(result.every(v => v.pulseScore >= 30)).toBe(true)
  })
})
