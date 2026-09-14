import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import {
  findNeighborhoodPage,
  listNeighborhoodPages,
  listNeighborhoodVenues,
  neighborhoodPath,
  neighborhoodSlug,
} from '../neighborhood-pages'

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v',
    name: 'Room',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.61, lng: -122.32, address: '' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

describe('neighborhood pages', () => {
  it('slugs tagged Seattle hoods including Ballard, Georgetown, and SoDo', () => {
    expect(neighborhoodSlug('Capitol Hill')).toBe('capitol-hill')
    expect(neighborhoodSlug('Ballard')).toBe('ballard')
    expect(neighborhoodSlug('Georgetown')).toBe('georgetown')
    expect(neighborhoodSlug('SoDo')).toBe('sodo')
    expect(neighborhoodPath('capitol-hill')).toBe('/n/capitol-hill')
  })

  it('lists guest-safe venues for a slug without GPS', () => {
    const venues = [
      venue({ id: 'neumos', name: 'Neumos' }),
      venue({ id: 'sunset', name: 'Sunset', neighborhood: 'Ballard' }),
      venue({ id: 'hoct', name: 'Hoctopuss', neighborhood: 'Georgetown' }),
      venue({ id: 'sodo', name: 'SoDo room', neighborhood: 'SoDo' }),
    ]
    expect(findNeighborhoodPage(venues, 'ballard')?.name).toBe('Ballard')
    expect(listNeighborhoodVenues(venues, 'capitol-hill').map((row) => row.id)).toEqual(['neumos'])
    expect(listNeighborhoodPages(venues).map((page) => page.slug)).toEqual(
      expect.arrayContaining(['capitol-hill', 'ballard', 'georgetown', 'sodo']),
    )
  })
})
