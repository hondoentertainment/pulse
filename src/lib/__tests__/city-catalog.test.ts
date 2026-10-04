import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import {
  cityColdStartSplit,
  coastCityKeyForVenueId,
  loadCityCatalog,
  mergeCuratedWithServer,
} from '../city-catalog'
import { getPortlandLaunchVenues } from '../portland-launch-venues'
import { getSanFranciscoLaunchVenues } from '../san-francisco-launch-venues'
import { getSeattleLaunchVenues } from '../seattle-launch-venues'

function venue(partial: Partial<Venue> & Pick<Venue, 'id' | 'name' | 'city' | 'state'>): Venue {
  return {
    location: { lat: 0, lng: 0, address: '' },
    pulseScore: 0,
    ...partial,
  }
}

describe('loadCityCatalog', () => {
  it('opens on Seattle curated rooms and does not ask for Portland or San Francisco', async () => {
    const seen: string[] = []
    const result = await loadCityCatalog('seattle', {
      hasServer: true,
      loadCurated: async (key) => {
        seen.push(key)
        return key === 'seattle' ? getSeattleLaunchVenues() : []
      },
      fetchSeattle: async () => [],
      fetchCity: async () => {
        throw new Error('other city fetch')
      },
    })
    expect(seen).toEqual(['seattle'])
    expect(result.usedFallback).toBe(true)
    expect(result.venues.every((row) => row.city === 'Seattle')).toBe(true)
    expect(cityColdStartSplit(result.venues).deferred).toEqual([])
  })

  it('loads Portland curated rooms without fetching Seattle or San Francisco', async () => {
    const seen: string[] = []
    let seattleFetched = false
    let cityQuery: string | null = null
    const result = await loadCityCatalog('portland', {
      hasServer: true,
      loadCurated: async (key) => {
        seen.push(key)
        return key === 'portland' ? getPortlandLaunchVenues() : []
      },
      fetchSeattle: async () => {
        seattleFetched = true
        return getSeattleLaunchVenues()
      },
      fetchCity: async (city, state) => {
        cityQuery = `${city},${state}`
        return []
      },
    })
    expect(seen).toEqual(['portland'])
    expect(seattleFetched).toBe(false)
    expect(cityQuery).toBe('Portland,OR')
    expect(result.usedFallback).toBe(false)
    expect(result.venues.map((row) => row.city)).toEqual(result.venues.map(() => 'Portland'))
    expect(result.venues.some((row) => row.city === 'Seattle' || row.city === 'San Francisco')).toBe(false)
  })

  it('loads San Francisco curated rooms and keeps a larger catalog behind the cold start', async () => {
    const curated = getSanFranciscoLaunchVenues()
    const osm = venue({
      id: 'sf-osm-1',
      name: 'Uncurated Room',
      city: 'San Francisco',
      state: 'CA',
      inventorySource: 'osm',
      seeded: true,
    })
    const result = await loadCityCatalog('san-francisco', {
      hasServer: true,
      loadCurated: async () => curated,
      fetchSeattle: async () => {
        throw new Error('seattle fetch')
      },
      fetchCity: async () => [osm, venue({
        id: 'pdx-stray',
        name: 'Stray',
        city: 'Portland',
        state: 'OR',
      })],
    })
    expect(result.venues.every((row) => row.city === 'San Francisco')).toBe(true)
    const split = cityColdStartSplit(result.venues)
    expect(split.launch.every((row) => row.inventorySource === 'curated-seed')).toBe(true)
    expect(split.deferred.map((row) => row.id)).toEqual(['sf-osm-1'])
    expect(split.launch).toHaveLength(curated.length)
  })

  it('keeps Seattle server rows and still partitions curated ahead of OSM', async () => {
    const curated = getSeattleLaunchVenues().slice(0, 1)
    const server = [
      ...curated,
      venue({
        id: 'osm-1',
        name: 'OSM Bar',
        city: 'Seattle',
        state: 'WA',
        inventorySource: 'osm',
        seeded: true,
      }),
      venue({
        id: 'pdx-1',
        name: 'Crystal Ballroom',
        city: 'Portland',
        state: 'OR',
        inventorySource: 'curated-seed',
        seeded: true,
      }),
    ]
    const result = await loadCityCatalog('seattle', {
      hasServer: true,
      loadCurated: async () => curated,
      fetchSeattle: async () => server,
    })
    expect(result.venues.map((row) => row.id)).toEqual([curated[0].id, 'osm-1'])
    const split = cityColdStartSplit(result.venues)
    expect(split.launch.map((row) => row.id)).toEqual([curated[0].id])
    expect(split.deferred.map((row) => row.id)).toEqual(['osm-1'])
  })

  it('resolves a shared venue id to one city', () => {
    expect(coastCityKeyForVenueId('pdx-crystal-ballroom')).toBe('portland')
    expect(coastCityKeyForVenueId('sf-chapel')).toBe('san-francisco')
    expect(coastCityKeyForVenueId('venue-1')).toBe('seattle')
    expect(coastCityKeyForVenueId('la-exchange')).toBeNull()
    expect(mergeCuratedWithServer(
      [venue({ id: 'a', name: 'Crystal Ballroom', city: 'Portland', state: 'OR' })],
      [venue({ id: 'b', name: 'Crystal Ballroom', city: 'Portland', state: 'OR', pulseScore: 4 })],
    ).map((row) => row.id)).toEqual(['b'])
  })
})
