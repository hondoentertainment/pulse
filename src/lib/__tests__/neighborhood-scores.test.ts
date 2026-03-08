import { describe, it, expect } from 'vitest'
import {
  calculateNeighborhoodScore,
  getNeighborhoodLeaderboard,
  calculateCityScore,
  compareCities,
  assignVenueToNeighborhood,
  getHottestNeighborhood,
  getCityTrending,
} from '../neighborhood-scores'
import type { Neighborhood } from '../neighborhood-scores'
import type { Pulse, Venue } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1', venueId: 'v1', photos: ['img.jpg'],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return { id: 'v1', name: 'Bar A', location: { lat: 40.7, lng: -74.0, address: '' }, pulseScore: 70, ...overrides }
}

const neighborhood: Neighborhood = {
  id: 'n1', name: 'Downtown', city: 'NYC',
  bounds: { north: 40.75, south: 40.69, east: -73.98, west: -74.02 },
  venueIds: ['v1', 'v2'],
}

describe('calculateNeighborhoodScore', () => {
  it('scores a neighborhood', () => {
    const venues = [makeVenue({ id: 'v1', pulseScore: 80 }), makeVenue({ id: 'v2', pulseScore: 60 })]
    const pulses = [makePulse({ venueId: 'v1' })]
    const score = calculateNeighborhoodScore(neighborhood, venues, pulses)
    expect(score.score).toBe(70)
    expect(score.totalVenues).toBe(2)
    expect(score.activeVenueCount).toBeGreaterThanOrEqual(1)
  })

  it('returns 0 for empty neighborhood', () => {
    const emptyN = { ...neighborhood, venueIds: [] }
    const score = calculateNeighborhoodScore(emptyN, [], [])
    expect(score.score).toBe(0)
  })
})

describe('getNeighborhoodLeaderboard', () => {
  it('ranks neighborhoods with hottest flag', () => {
    const n2: Neighborhood = { id: 'n2', name: 'Uptown', city: 'NYC', bounds: { north: 40.8, south: 40.75, east: -73.95, west: -74.0 }, venueIds: ['v3'] }
    const venues = [
      makeVenue({ id: 'v1', pulseScore: 80 }),
      makeVenue({ id: 'v2', pulseScore: 60 }),
      makeVenue({ id: 'v3', pulseScore: 90 }),
    ]
    const board = getNeighborhoodLeaderboard([neighborhood, n2], venues, [])
    expect(board).toHaveLength(2)
    expect(board[0].hottest).toBe(true)
    expect(board[0].score).toBeGreaterThanOrEqual(board[1].score)
  })
})

describe('calculateCityScore', () => {
  it('calculates city score', () => {
    const venues = [makeVenue({ id: 'v1', city: 'NYC', pulseScore: 80 }), makeVenue({ id: 'v2', city: 'NYC', pulseScore: 60 })]
    const pulses = [makePulse({ venueId: 'v1' })]
    const score = calculateCityScore('NYC', venues, pulses)
    expect(score.city).toBe('NYC')
    expect(score.totalVenues).toBe(2)
    expect(score.score).toBe(70)
  })
})

describe('compareCities', () => {
  it('ranks cities', () => {
    const venues = [
      makeVenue({ id: 'v1', city: 'NYC', pulseScore: 80 }),
      makeVenue({ id: 'v2', city: 'LA', pulseScore: 60 }),
    ]
    const comparison = compareCities(['NYC', 'LA'], venues, [])
    expect(comparison.cities).toHaveLength(2)
    expect(comparison.cities[0].city).toBe('NYC')
    expect(comparison.cities[0].rank).toBe(1)
  })
})

describe('assignVenueToNeighborhood', () => {
  it('assigns venue within bounds', () => {
    const venue = makeVenue({ location: { lat: 40.72, lng: -74.0, address: '' } })
    expect(assignVenueToNeighborhood(venue, [neighborhood])).toBe('n1')
  })

  it('returns null for out of bounds', () => {
    const venue = makeVenue({ location: { lat: 41.0, lng: -74.0, address: '' } })
    expect(assignVenueToNeighborhood(venue, [neighborhood])).toBeNull()
  })
})

describe('getHottestNeighborhood', () => {
  it('returns hottest', () => {
    const venues = [makeVenue({ id: 'v1', pulseScore: 80 }), makeVenue({ id: 'v2', pulseScore: 60 })]
    const hottest = getHottestNeighborhood([neighborhood], venues, [])
    expect(hottest).not.toBeNull()
    expect(hottest!.hottest).toBe(true)
  })
})

describe('getCityTrending', () => {
  it('returns top venues in city', () => {
    const venues = [
      makeVenue({ id: 'v1', city: 'NYC', pulseScore: 90 }),
      makeVenue({ id: 'v2', city: 'NYC', pulseScore: 50 }),
      makeVenue({ id: 'v3', city: 'LA', pulseScore: 80 }),
    ]
    const trending = getCityTrending('NYC', venues, [], 5)
    expect(trending).toHaveLength(2)
    expect(trending[0].pulseScore).toBeGreaterThanOrEqual(trending[1].pulseScore)
  })
})
