import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import { buildTonightHome, resolveHomeNeighborhood } from '../tonight-home'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 90,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'u1',
    venueId: 'neumos',
    photos: [],
    energyRating: 'electric',
    caption: 'Go now',
    kind: 'review',
    hasBody: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('resolveHomeNeighborhood', () => {
  it('prefers a saved nearby venue neighborhood', () => {
    const venues = [
      makeVenue(),
      makeVenue({
        id: 'far',
        neighborhood: 'Ballard',
        location: { lat: 47.668, lng: -122.38, address: 'Ballard' },
      }),
    ]
    expect(resolveHomeNeighborhood(venues, { lat: 47.614, lng: -122.32 }, ['neumos']))
      .toBe('Capitol Hill')
  })
})

describe('buildTonightHome', () => {
  it('titles Tonight · neighborhood and ranks start-here from live reviews', () => {
    const barrio = makeVenue({
      id: 'barrio',
      name: 'Barrio',
      pulseScore: 70,
    })
    const chop = makeVenue({
      id: 'chop',
      name: 'Chop Suey',
      pulseScore: 40,
    })
    const now = new Date('2026-09-11T04:40:00.000Z')
    const createdAt = new Date(now.getTime() - 8 * 60 * 1000).toISOString()
    const home = buildTonightHome({
      venues: [makeVenue(), barrio, chop],
      pulses: [
        makePulse({ createdAt }),
        makePulse({ id: 'p2', venueId: 'barrio', energyRating: 'buzzing', createdAt }),
        makePulse({ id: 'p3', venueId: 'chop', energyRating: 'chill', createdAt }),
      ],
      userLocation: { lat: 47.614, lng: -122.32 },
      savedVenueIds: ['neumos'],
      now,
    })
    expect(home.title).toBe('Tonight · Capitol Hill')
    expect(home.subtitle).toContain('based on time + saves')
    expect(home.startHere?.venue.name).toBeTruthy()
    expect(home.startHere?.headline).toMatch(/is \w+ right now/)
    expect(home.heatingUp.length).toBeGreaterThan(0)
  })
})
