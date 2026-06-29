import { describe, it, expect } from 'vitest'
import { buildPresenceUserLocations } from '../presence-context'
import type { Pulse, Venue } from '../types'

const venue: Pick<Venue, 'id' | 'location'> = {
  id: 'v1',
  location: { lat: 47.6062, lng: -122.3321, address: '123 Pike St' },
}

function makePulse(overrides: Partial<Pulse>): Pulse {
  return {
    id: 'p',
    userId: 'u',
    venueId: 'v1',
    photos: [],
    energyRating: 3 as Pulse['energyRating'],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

describe('buildPresenceUserLocations', () => {
  it('places recent pulse authors at the venue coordinates', () => {
    const locations = buildPresenceUserLocations(venue, [
      makePulse({ userId: 'alice', createdAt: minutesAgo(1) }),
    ])
    expect(locations.alice).toEqual({
      lat: 47.6062,
      lng: -122.3321,
      lastUpdate: expect.any(String),
    })
  })

  it('ignores pulses from other venues', () => {
    const locations = buildPresenceUserLocations(venue, [
      makePulse({ userId: 'bob', venueId: 'v2', createdAt: minutesAgo(1) }),
    ])
    expect(locations).toEqual({})
  })

  it('drops pulses older than the freshness window', () => {
    const locations = buildPresenceUserLocations(venue, [
      makePulse({ userId: 'carol', createdAt: minutesAgo(20) }),
    ])
    expect(locations).toEqual({})
  })

  it('respects a custom window', () => {
    const locations = buildPresenceUserLocations(
      venue,
      [makePulse({ userId: 'dave', createdAt: minutesAgo(8) })],
      10,
    )
    expect(locations.dave).toBeDefined()
  })

  it('keeps only the most recent pulse per user', () => {
    const locations = buildPresenceUserLocations(venue, [
      makePulse({ id: 'old', userId: 'eve', createdAt: minutesAgo(4) }),
      makePulse({ id: 'new', userId: 'eve', createdAt: minutesAgo(1) }),
    ])
    expect(Object.keys(locations)).toEqual(['eve'])
    expect(new Date(locations.eve.lastUpdate).getTime()).toBeGreaterThan(
      Date.now() - 2 * 60_000,
    )
  })

  it('skips pulses with an unparseable timestamp', () => {
    const locations = buildPresenceUserLocations(venue, [
      makePulse({ userId: 'frank', createdAt: 'not-a-date' }),
    ])
    expect(locations).toEqual({})
  })
})
