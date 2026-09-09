import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEATTLE_LAUNCH_MAX_VENUES,
  SEATTLE_LAUNCH_MIN_VENUES,
  SEATTLE_LAUNCH_NEIGHBORHOODS,
  SEATTLE_LAUNCH_VENUES,
  SEATTLE_LAUNCH_VENUE_UUIDS,
  assertSeattleLaunchInventory,
  getSeattleLaunchNeighborhoodCoverage,
} from '../seattle-launch-venues'

const CATALOG_MIGRATION = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260909120000_seattle_launch_venue_catalog.sql'),
  'utf8',
)

describe('Seattle launch inventory', () => {
  it('contains 25-40 curated venues', () => {
    expect(SEATTLE_LAUNCH_VENUES.length).toBeGreaterThanOrEqual(SEATTLE_LAUNCH_MIN_VENUES)
    expect(SEATTLE_LAUNCH_VENUES.length).toBeLessThanOrEqual(SEATTLE_LAUNCH_MAX_VENUES)
    expect(() => assertSeattleLaunchInventory()).not.toThrow()
  })

  it('seeds Capitol Hill, Belltown, Fremont, Ballard, and Downtown', () => {
    const coverage = getSeattleLaunchNeighborhoodCoverage()
    for (const neighborhood of SEATTLE_LAUNCH_NEIGHBORHOODS) {
      expect(coverage[neighborhood]).toBeGreaterThanOrEqual(4)
    }
  })

  it('marks every listing as curated seed with no invented live reports', () => {
    for (const venue of SEATTLE_LAUNCH_VENUES) {
      expect(venue.city).toBe('Seattle')
      expect(venue.state).toBe('WA')
      expect(venue.seeded).toBe(true)
      expect(venue.inventorySource).toBe('curated-seed')
      expect(venue.pulseScore).toBe(0)
      expect(venue.lastPulseAt).toBeUndefined()
      expect(venue.liveSummary).toBeUndefined()
    }
  })

  it('maps every curated venue to a deterministic Supabase UUID used by the catalog migration', () => {
    expect(Object.keys(SEATTLE_LAUNCH_VENUE_UUIDS)).toHaveLength(SEATTLE_LAUNCH_VENUES.length)
    const seen = new Set<string>()
    for (const venue of SEATTLE_LAUNCH_VENUES) {
      const uuid = SEATTLE_LAUNCH_VENUE_UUIDS[venue.id]
      expect(uuid, `missing UUID for ${venue.id}`).toMatch(
        /^[0-9a-f]{8}-0000-4000-8000-0000000000[0-9a-f]{2}$/,
      )
      expect(seen.has(uuid)).toBe(false)
      seen.add(uuid)
      expect(CATALOG_MIGRATION).toContain(uuid)
      expect(CATALOG_MIGRATION).toContain(venue.name.replace(/'/g, "''"))
      expect(CATALOG_MIGRATION).toContain(venue.location.address)
    }
  })
})
