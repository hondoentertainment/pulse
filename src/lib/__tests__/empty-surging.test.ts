import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import {
  EMPTY_SURGING_CTA,
  emptySurgingPulseHref,
  listEmptySurgingStartHere,
} from '../empty-surging'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.6145, lng: -122.3205, address: 'Pike' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

describe('listEmptySurgingStartHere', () => {
  it('returns 3–5 catalog rooms and prefers Launch 33 / claimed', () => {
    const venues = [
      makeVenue(),
      makeVenue({ id: 'barrio', name: 'Barrio', claimVerified: true }),
      makeVenue({ id: 'q', name: 'Q Nightclub' }),
      makeVenue({
        id: 'osm',
        name: 'Random OSM',
        inventorySource: 'osm',
        seeded: false,
      }),
      makeVenue({ id: 'chop', name: 'Chop Suey' }),
    ]
    const start = listEmptySurgingStartHere(venues)
    expect(start.length).toBeGreaterThanOrEqual(3)
    expect(start.length).toBeLessThanOrEqual(5)
    expect(start[0]?.id).toBe('barrio')
    expect(start.map((venue) => venue.id)).toContain('neumos')
    expect(EMPTY_SURGING_CTA).toBe('Be the first · Pulse')
  })

  it('does not invent rooms when the catalog is empty', () => {
    expect(listEmptySurgingStartHere([])).toEqual([])
  })

  it('prefers Seattle density hoods the way Capitol Hill is preferred', () => {
    const start = listEmptySurgingStartHere([
      makeVenue({ id: 'lake', name: 'Lake City Bar', neighborhood: 'Lake City', inventorySource: 'osm', seeded: false }),
      makeVenue({ id: 'sunset', name: 'Sunset', neighborhood: 'Ballard', inventorySource: 'curated-seed', seeded: true }),
      makeVenue({ id: 'hoover', name: 'Hooverville', neighborhood: 'SoDo', inventorySource: 'curated-seed', seeded: true }),
      makeVenue({ id: 'ninebar', name: '9bar', neighborhood: 'Georgetown', inventorySource: 'curated-seed', seeded: true }),
    ])
    expect(start.map((venue) => venue.id)).toEqual(expect.arrayContaining(['sunset', 'hoover', 'ninebar']))
    expect(start[0]?.neighborhood).not.toBe('Lake City')
  })
})

describe('emptySurgingPulseHref', () => {
  it('opens compose for signed-in users and /auth for guests', () => {
    expect(emptySurgingPulseHref({
      isPlaceholder: false,
      hasSession: true,
      venueId: 'neumos',
    })).toEqual({ kind: 'compose', venueId: 'neumos' })
    expect(emptySurgingPulseHref({
      isPlaceholder: false,
      hasSession: false,
      venueId: 'neumos',
    })).toEqual({ kind: 'auth', next: '/venue/neumos?compose=1' })
  })
})
