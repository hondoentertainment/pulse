import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import {
  buildTonightHome,
  compareTonightRank,
  listTonightFollowingFeed,
  listTonightFollowingVenues,
  listTonightNearVenues,
  resolveHomeNeighborhood,
  TONIGHT_EMPTY_LOOP,
  timeOfDayBoost,
} from '../tonight-home'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 90,
    inventorySource: 'curated-seed',
    seeded: true,
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
    expect(home.empty).toBeNull()
  })

  it('uses an X-style catalog Start here when nothing is surging', () => {
    const home = buildTonightHome({
      venues: [makeVenue({ pulseScore: 0 })],
      pulses: [],
      userLocation: null,
      locationDenied: true,
      now: new Date('2026-09-11T04:40:00.000Z'),
    })
    expect(home.title).toContain('Tonight ·')
    expect(home.subtitle).toContain('Launch 33 fallback')
    expect(home.empty).toBeNull()
    expect(home.startHere?.suggested).toBe(true)
    expect(home.startHere?.headline).toMatch(/^Start at /)
  })

  it('still starts at a catalog venue that has no neighborhood tag', () => {
    const home = buildTonightHome({
      venues: [makeVenue({ neighborhood: undefined, pulseScore: 10 })],
      pulses: [],
      userLocation: { lat: 47.614, lng: -122.32 },
      now: new Date('2026-09-11T04:40:00.000Z'),
    })
    expect(home.empty).toBeNull()
    expect(home.startHere?.venue.name).toBe('Neumos')
    expect(home.startHere?.suggested).toBe(true)
  })

  it('teaches map → venue → pulse only when the catalog is empty', () => {
    const home = buildTonightHome({
      venues: [],
      pulses: [],
      userLocation: null,
      locationDenied: true,
      now: new Date('2026-09-11T04:40:00.000Z'),
    })
    expect(home.startHere).toBeNull()
    expect(home.empty?.headline).toBe(TONIGHT_EMPTY_LOOP.headline)
  })
})

describe('listTonightFollowingVenues', () => {
  it('is honestly empty without saves or follows', () => {
    expect(listTonightFollowingVenues([makeVenue()], [], [])).toEqual([])
  })

  it('returns saved venues without inventing a friends graph', () => {
    const saved = makeVenue({ id: 'saved', name: 'Barrio' })
    expect(listTonightFollowingVenues([makeVenue(), saved], ['saved'], []).map((v) => v.id))
      .toEqual(['saved'])
  })
})

describe('listTonightFollowingFeed', () => {
  it('lists only persisted follows plus the latest live pulse', () => {
    const followed = makeVenue({ id: 'followed', name: 'Barrio' })
    const other = makeVenue()
    const older: Pulse = {
      id: 'old',
      userId: 'u1',
      venueId: 'followed',
      photos: [],
      energyRating: 'chill',
      caption: 'Earlier',
      kind: 'review',
      createdAt: '2026-09-12T01:00:00.000Z',
      expiresAt: '2026-09-12T02:30:00.000Z',
      reactions: { fire: [], eyes: [], skull: [], lightning: [] },
      views: 0,
    }
    const latest: Pulse = {
      ...older,
      id: 'new',
      caption: 'Room is packed',
      createdAt: '2026-09-12T01:40:00.000Z',
    }
    const feed = listTonightFollowingFeed(
      [other, followed],
      [older, latest],
      ['followed'],
    )
    expect(feed).toHaveLength(1)
    expect(feed[0]?.venue.id).toBe('followed')
    expect(feed[0]?.latestPulse?.caption).toBe('Room is packed')
  })

  it('stays empty when the user follows nobody', () => {
    expect(listTonightFollowingFeed([makeVenue()], [], [])).toEqual([])
  })
})

describe('listTonightNearVenues', () => {
  it('falls back to Launch 33 when location is off', () => {
    const near = listTonightNearVenues([
      makeVenue(),
      makeVenue({
        id: 'osm',
        name: 'Random OSM',
        inventorySource: 'osm',
        seeded: false,
      }),
    ], null)
    expect(near.usedLaunch33Fallback).toBe(true)
    expect(near.venues.map((venue) => venue.id)).toEqual(['neumos'])
  })

  it('uses the rankable catalog when nothing is marked Launch 33', () => {
    const near = listTonightNearVenues([
      makeVenue({
        inventorySource: 'osm',
        seeded: false,
      }),
    ], null)
    expect(near.usedLaunch33Fallback).toBe(true)
    expect(near.venues.map((venue) => venue.id)).toEqual(['neumos'])
  })

  it('sorts by geo when a pin is available', () => {
    const far = makeVenue({
      id: 'far',
      name: 'Far Bar',
      location: { lat: 47.668, lng: -122.38, address: 'Ballard' },
    })
    const near = listTonightNearVenues([makeVenue(), far], { lat: 47.614, lng: -122.32 })
    expect(near.usedLaunch33Fallback).toBe(false)
    expect(near.venues[0]?.id).toBe('neumos')
  })
})

describe('compareTonightRank', () => {
  it('prefers curated over OSM when energy is tied', () => {
    const now = new Date('2026-09-11T04:40:00.000Z')
    const curated = makeVenue({ id: 'curated', name: 'Neumos', inventorySource: 'curated-seed' })
    const osm = makeVenue({
      id: 'osm',
      name: 'Nearby Bar',
      inventorySource: 'osm',
      seeded: false,
    })
    expect(compareTonightRank(curated, osm, [], now, { lat: 47.614, lng: -122.32 })).toBeLessThan(0)
  })
})

describe('timeOfDayBoost', () => {
  it('boosts music venues at night without inventing energy', () => {
    expect(timeOfDayBoost('Music Venue', 22)).toBeGreaterThan(timeOfDayBoost('Cafe', 22))
    expect(timeOfDayBoost('Restaurant', 17)).toBeGreaterThan(0)
  })
})
