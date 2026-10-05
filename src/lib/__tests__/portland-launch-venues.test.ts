import { describe, expect, it } from 'vitest'
import { hasValidCatalogCoords, reportCatalogQuality } from '../catalog-quality'
import { neighborhoodSlug } from '../neighborhood-slugs'
import { SEATTLE_TAGGED_NEIGHBORHOODS } from '../neighborhood-slugs'
import { readFileSync } from 'node:fs'
import {
  PORTLAND_LAUNCH_MAX_VENUES,
  PORTLAND_LAUNCH_MIN_VENUES,
  PORTLAND_LAUNCH_NEIGHBORHOODS,
  PORTLAND_LAUNCH_VENUES,
  assertPortlandLaunchInventory,
  getPortlandLaunchVenues,
} from '../portland-launch-venues'
import { getSanFranciscoLaunchVenues } from '../san-francisco-launch-venues'

describe('Portland launch inventory', () => {
  it('contains 25-40 curated rooms with real neighborhoods and no photos', () => {
    expect(PORTLAND_LAUNCH_VENUES.length).toBeGreaterThanOrEqual(PORTLAND_LAUNCH_MIN_VENUES)
    expect(PORTLAND_LAUNCH_VENUES.length).toBeLessThanOrEqual(PORTLAND_LAUNCH_MAX_VENUES)
    expect(() => assertPortlandLaunchInventory()).not.toThrow()
    const hoods = new Set(PORTLAND_LAUNCH_VENUES.map((venue) => venue.neighborhood))
    expect([...hoods].sort()).toEqual([...PORTLAND_LAUNCH_NEIGHBORHOODS].sort())
    const seattleSlugs = new Set(SEATTLE_TAGGED_NEIGHBORHOODS.map((name) => neighborhoodSlug(name)))
    for (const venue of PORTLAND_LAUNCH_VENUES) {
      expect(venue.city).toBe('Portland')
      expect(venue.state).toBe('OR')
      expect(venue.pulseScore).toBe(0)
      expect(venue.inventorySource).toBe('curated-seed')
      expect(venue.imageUrl).toBeUndefined()
      expect(hasValidCatalogCoords(venue)).toBe(true)
      expect(seattleSlugs.has(neighborhoodSlug(venue.neighborhood))).toBe(false)
    }
    const report = reportCatalogQuality(PORTLAND_LAUNCH_VENUES)
    expect(report.hiddenBadPins).toBe(0)
    expect(report.rankable).toBe(PORTLAND_LAUNCH_VENUES.length)
  })

  it('ships the same UUID the seed migration inserts, and keeps the share slug', () => {
    const sql = readFileSync(
      'supabase/migrations/20261005120000_portland_san_francisco_launch_venues.sql',
      'utf8',
    )
    const durable = getPortlandLaunchVenues()
    expect(durable).toHaveLength(PORTLAND_LAUNCH_VENUES.length)
    expect(durable.map((venue) => venue.catalogSlug)).toEqual(PORTLAND_LAUNCH_VENUES.map((venue) => venue.id))
    expect(durable[0]?.catalogSlug).toBe('pdx-crystal-ballroom')
    for (const venue of durable) {
      expect(venue.id).toMatch(/^d0000000-0000-4000-8000-[0-9a-f]{12}$/)
      expect(sql).toContain(venue.id)
      expect(sql).toContain(venue.catalogSlug)
    }
    const sf = getSanFranciscoLaunchVenues()
    expect(sf[0]?.catalogSlug).toBe('sf-chapel')
    expect(sf).toHaveLength(32)
    for (const venue of sf) {
      expect(sql).toContain(venue.id)
      expect(sql).toContain(venue.catalogSlug)
    }
  })
})
