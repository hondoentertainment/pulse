import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import {
  findNeighborhoodPage,
  listNeighborhoodPages,
  listNeighborhoodVenues,
  neighborhoodPath,
  neighborhoodSlug,
  resolveNeighborhoodPage,
  SEATTLE_TAGGED_NEIGHBORHOODS,
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

  it('exposes a guest-safe page for every hood already tagged on Seattle venues', () => {
    const extraSlugs = [
      'fremont',
      'belltown',
      'downtown',
      'west-seattle',
      'queen-anne',
      'university-district',
      'pioneer-square',
      'greenwood',
      'columbia-city',
      'phinney-ridge',
      'lake-city',
      'beacon-hill',
      'south-lake-union',
      'green-lake',
      'rainier-valley',
      'central-district',
      'northgate',
      'magnolia',
      'international-district',
      'ravenna',
      'wallingford',
    ]
    const pages = listNeighborhoodPages([])
    const slugs = pages.map((page) => page.slug)
    expect(resolveNeighborhoodPage('fremont')?.name).toBe('Fremont')
    expect(resolveNeighborhoodPage('west-seattle')?.name).toBe('West Seattle')
    expect(resolveNeighborhoodPage('queen-anne')?.name).toBe('Queen Anne')
    expect(resolveNeighborhoodPage('portland')).toBeNull()
    expect(slugs).toEqual(expect.arrayContaining(extraSlugs))
    expect(slugs).toEqual(expect.arrayContaining(['capitol-hill', 'ballard', 'georgetown', 'sodo']))
    expect(new Set(slugs).size).toBe(SEATTLE_TAGGED_NEIGHBORHOODS.length)

    const catalog = JSON.parse(
      readFileSync(resolve(process.cwd(), 'supabase/seeds/seattle-osm-venues.json'), 'utf8'),
    ) as { venues: Array<{ neighborhood?: string | null }> }
    const tagged = new Set(
      catalog.venues
        .map((venue) => neighborhoodSlug(venue.neighborhood))
        .filter((slug): slug is string => Boolean(slug)),
    )
    expect(slugs).toEqual(expect.arrayContaining([...tagged]))
    expect(tagged.size).toBe(SEATTLE_TAGGED_NEIGHBORHOODS.length)
  })
})
