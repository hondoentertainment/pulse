import { describe, it, expect } from 'vitest'
import { getTonightPicks } from '../tonight-feed'
import type { Pulse, User, Venue } from '../types'

const user: User = {
  id: 'u1',
  username: 'nightowl',
  friends: [],
  favoriteVenues: [],
  followedVenues: [],
  createdAt: new Date().toISOString(),
  venueCheckInHistory: {},
}

const venues: Venue[] = [
  {
    id: 'v1',
    name: 'Neon Room',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    city: 'Seattle',
    state: 'WA',
    category: 'Bar',
    pulseScore: 72,
    lastPulseAt: new Date().toISOString(),
  },
  {
    id: 'v2',
    name: 'Quiet Lounge',
    location: { lat: 47.61, lng: -122.33, address: '2 Union' },
    city: 'Seattle',
    state: 'WA',
    category: 'Lounge',
    pulseScore: 20,
  },
]

const pulses: Pulse[] = [
  {
    id: 'p1',
    userId: 'u2',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 10,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 80 * 60 * 1000).toISOString(),
  },
  {
    id: 'p2',
    userId: 'u3',
    venueId: 'v1',
    photos: [],
    energyRating: 'electric',
    reactions: { fire: ['u4'], eyes: [], skull: [], lightning: [] },
    views: 5,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 85 * 60 * 1000).toISOString(),
  },
]

describe('getTonightPicks', () => {
  it('ranks buzzing venues when buzzing vibe selected', () => {
    const picks = getTonightPicks(user, venues, pulses, { vibe: 'buzzing', limit: 5 })
    expect(picks.length).toBeGreaterThan(0)
    expect(picks[0]?.recommendation.venue.id).toBe('v1')
    expect(picks[0]?.explanation.headline).toContain('Neon Room')
  })

  it('filters to energy match for specific vibe', () => {
    const electricVenues = venues.map((v) =>
      v.id === 'v1' ? { ...v, pulseScore: 88 } : v,
    )
    const picks = getTonightPicks(user, electricVenues, pulses, { vibe: 'electric', limit: 5 })
    expect(picks.length).toBeGreaterThan(0)
    for (const pick of picks) {
      expect(pick.energyMatch).toBe(true)
    }
  })
})
