import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEATTLE_LAUNCH_VENUES,
  SEATTLE_LAUNCH_VENUE_UUIDS,
  SEATTLE_OSM_INVENTORY_SOURCE,
  SEATTLE_OSM_TARGET_VENUES,
} from '../seattle-launch-venues'

const catalog = JSON.parse(
  readFileSync(resolve(process.cwd(), 'supabase/seeds/seattle-osm-venues.json'), 'utf8'),
) as {
  manifest: { selected: number; curatedKeptSeparate: number }
  venues: Array<{
    id: string
    name: string
    location_lat: number
    location_lng: number
    location_address: string
    city: string
    state: string
    inventory_source: string
    category: string
    osmType: string
    osmId: number
  }>
}

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260909180000_seattle_osm_venue_catalog.sql'),
  'utf8',
)

describe('Seattle OSM comprehensive catalog', () => {
  it(`contains up to ${SEATTLE_OSM_TARGET_VENUES} real OSM venues`, () => {
    expect(catalog.manifest.selected).toBe(catalog.venues.length)
    expect(catalog.venues.length).toBeGreaterThanOrEqual(400)
    expect(catalog.venues.length).toBeLessThanOrEqual(SEATTLE_OSM_TARGET_VENUES)
    expect(catalog.manifest.curatedKeptSeparate).toBe(SEATTLE_LAUNCH_VENUES.length)
  })

  it('uses osm inventory_source, Seattle WA, and real coordinates', () => {
    const ids = new Set<string>()
    for (const venue of catalog.venues) {
      expect(venue.inventory_source).toBe(SEATTLE_OSM_INVENTORY_SOURCE)
      expect(venue.city).toBe('Seattle')
      expect(venue.state).toBe('WA')
      expect(venue.name.trim().length).toBeGreaterThan(1)
      expect(venue.location_address).toMatch(/Seattle/i)
      expect(venue.location_lat).toBeGreaterThan(47.4)
      expect(venue.location_lat).toBeLessThan(47.8)
      expect(venue.location_lng).toBeGreaterThan(-122.5)
      expect(venue.location_lng).toBeLessThan(-122.2)
      expect(venue.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(ids.has(venue.id)).toBe(false)
      ids.add(venue.id)
      expect(Object.values(SEATTLE_LAUNCH_VENUE_UUIDS)).not.toContain(venue.id)
    }
  })

  it('does not duplicate curated launch names at nearby addresses', () => {
    const normalize = (value: string) =>
      value.toLowerCase().replace(/['’]/g, '').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim()
    const curatedNames = new Set(SEATTLE_LAUNCH_VENUES.map((venue) => normalize(venue.name)))
    const collisions = catalog.venues.filter((venue) => {
      const name = normalize(venue.name)
      if (!curatedNames.has(name)) return false
      return SEATTLE_LAUNCH_VENUES.some((curated) => {
        const same = normalize(curated.name) === name
        const dLat = curated.location.lat - venue.location_lat
        const dLng = curated.location.lng - venue.location_lng
        const meters = Math.hypot(dLat * 111_000, dLng * 75_000)
        return same && meters < 160
      })
    })
    expect(collisions.map((venue) => venue.name)).toEqual([])
  })

  it('embeds every selected venue in the idempotent migration', () => {
    expect(migration).toContain("inventory_source = 'osm'")
    expect(migration).toContain("inventory_source IS DISTINCT FROM 'curated-seed'")
    for (const venue of catalog.venues) {
      expect(migration).toContain(venue.id)
      expect(migration).toContain(venue.name.replace(/'/g, "''"))
    }
  })

  it('keeps distinct second locations and drops curated / non-nightlife collisions', () => {
    const names = catalog.venues.map((venue) => venue.name)
    expect(names).toContain('Showbox SoDo')
    expect(names.some((name) => /fremont brewing/i.test(name))).toBe(true)
    expect(names.some((name) => /^shorty/i.test(name))).toBe(false)
    expect(names.some((name) => /yoga|juice bar|arthur murray|dance studio/i.test(name))).toBe(false)
  })
})
