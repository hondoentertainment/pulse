import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import { searchVenueCatalog, searchVenueResults } from '../venue-search'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.6145, lng: -122.3205, address: '925 E Pike St' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

describe('searchVenueCatalog', () => {
  const catalog = [
    makeVenue(),
    makeVenue({
      id: 'barrio',
      name: 'Barrio',
      neighborhood: 'Capitol Hill',
    }),
    makeVenue({
      id: 'tractor',
      name: 'Tractor Tavern',
      neighborhood: 'Ballard',
      inventorySource: 'osm',
      seeded: false,
    }),
  ]

  it('finds Neumos by name without GPS', () => {
    const hits = searchVenueCatalog(catalog, 'neum')
    expect(hits.map((hit) => hit.venue.id)).toEqual(['venue-1'])
    expect(hits[0]?.matched).toBe('name')
  })

  it('finds Capitol Hill rooms by neighborhood', () => {
    const ids = searchVenueResults(catalog, 'capitol').map((venue) => venue.id)
    expect(ids).toContain('venue-1')
    expect(ids).toContain('barrio')
    expect(ids).not.toContain('tractor')
  })

  it('returns nothing for an empty query', () => {
    expect(searchVenueCatalog(catalog, '   ')).toEqual([])
  })

  it('prefers a curated name match over a weaker neighborhood hit', () => {
    const hits = searchVenueCatalog(catalog, 'bar')
    expect(hits[0]?.venue.name).toBe('Barrio')
  })
})
