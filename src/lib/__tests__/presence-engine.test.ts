import { describe, it, expect } from 'vitest'
import { calculatePresence, applyJitter, PresenceContext } from '../presence-engine'
import type { User, Pulse } from '../types'

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    username: overrides.id,
    friends: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> & { id: string; userId: string; venueId: string }): Pulse {
  const now = new Date()
  return {
    photos: [],
    energyRating: 'buzzing',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

const venueLocation = { lat: 47.6, lng: -122.3 }
const nearbyLoc = (offset = 0.00001) => ({
  lat: venueLocation.lat + offset,
  lng: venueLocation.lng - offset,
  lastUpdate: new Date().toISOString(),
})

describe('calculatePresence', () => {
  const currentUser = makeUser({ id: 'me', friends: ['friend-1', 'friend-2'] })
  const friend1 = makeUser({ id: 'friend-1', friends: ['me'], presenceSettings: { enabled: true, visibility: 'everyone', hideAtSensitiveVenues: false } })
  const friend2 = makeUser({ id: 'friend-2', friends: ['me'], presenceSettings: { enabled: true, visibility: 'everyone', hideAtSensitiveVenues: false } })
  const stranger = makeUser({ id: 'stranger-1', presenceSettings: { enabled: true, visibility: 'everyone', hideAtSensitiveVenues: false } })

  it('returns suppressed when fewer than 2 people are nearby', () => {
    const ctx: PresenceContext = {
      currentUser,
      allUsers: [friend1],
      allPulses: [],
      venueLocation,
      userLocations: { 'friend-1': nearbyLoc() },
    }
    const result = calculatePresence('venue-1', ctx)
    expect(result.isSuppressed).toBe(true)
    expect(result.prioritizedAvatars).toEqual([])
  })

  it('is not suppressed when >= 2 friends are nearby', () => {
    const ctx: PresenceContext = {
      currentUser,
      allUsers: [friend1, friend2],
      allPulses: [],
      venueLocation,
      userLocations: {
        'friend-1': nearbyLoc(0.00001),
        'friend-2': nearbyLoc(-0.00001),
      },
    }
    const result = calculatePresence('venue-1', ctx)
    expect(result.isSuppressed).toBe(false)
    expect(result.friendsHereNowCount + result.friendsNearbyCount).toBeGreaterThanOrEqual(2)
  })

  it('excludes users with presence disabled', () => {
    const disabledUser = makeUser({ id: 'friend-1', friends: ['me'], presenceSettings: { enabled: false, visibility: 'everyone', hideAtSensitiveVenues: false } })
    const ctx: PresenceContext = {
      currentUser,
      allUsers: [disabledUser, friend2],
      allPulses: [],
      venueLocation,
      userLocations: {
        'friend-1': nearbyLoc(),
        'friend-2': nearbyLoc(-0.00001),
      },
    }
    const result = calculatePresence('venue-1', ctx)
    expect(result.friendsHereNowCount + result.friendsNearbyCount).toBeLessThanOrEqual(1)
  })

  it('respects friends-only visibility', () => {
    const friendsOnly = makeUser({ id: 'stranger-1', presenceSettings: { enabled: true, visibility: 'friends', hideAtSensitiveVenues: false } })
    const ctx: PresenceContext = {
      currentUser,
      allUsers: [friend1, friendsOnly],
      allPulses: [],
      venueLocation,
      userLocations: {
        'friend-1': nearbyLoc(),
        'stranger-1': nearbyLoc(-0.00001),
      },
    }
    const result = calculatePresence('venue-1', ctx)
    // stranger with friends-only won't appear because currentUser isn't their friend
    expect(result.friendsHereNowCount + result.friendsNearbyCount + result.familiarFacesCount).toBeLessThanOrEqual(1)
  })

  it('identifies familiar faces through mutual reactions', () => {
    const pulse = makePulse({
      id: 'p-1',
      userId: 'me',
      venueId: 'venue-1',
      reactions: { fire: ['stranger-1'], eyes: [], skull: [], lightning: [] },
    })
    const ctx: PresenceContext = {
      currentUser,
      allUsers: [friend1, friend2, stranger],
      allPulses: [pulse],
      venueLocation,
      userLocations: {
        'friend-1': nearbyLoc(0.00001),
        'friend-2': nearbyLoc(-0.00001),
        'stranger-1': nearbyLoc(0.00002),
      },
    }
    const result = calculatePresence('venue-1', ctx)
    expect(result.familiarFacesCount).toBeGreaterThanOrEqual(1)
  })

  it('does not include current user in counts', () => {
    const ctx: PresenceContext = {
      currentUser,
      allUsers: [currentUser, friend1, friend2],
      allPulses: [],
      venueLocation,
      userLocations: {
        'me': nearbyLoc(),
        'friend-1': nearbyLoc(0.00001),
        'friend-2': nearbyLoc(-0.00001),
      },
    }
    const result = calculatePresence('venue-1', ctx)
    expect(result.friendsHereNowCount + result.friendsNearbyCount).toBeLessThanOrEqual(2)
  })
})

describe('applyJitter', () => {
  it('returns "0" for zero', () => {
    expect(applyJitter(0)).toBe('0')
  })

  it('returns exact count for small numbers', () => {
    expect(applyJitter(3)).toBe('3')
  })

  it('returns rounded count with + for larger numbers', () => {
    const result = applyJitter(7)
    expect(result).toMatch(/\d+\+/)
  })
})
