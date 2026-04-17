import type { Venue } from './types'

/**
 * Prod-safe wrapper around the international-city venue fixtures.
 *
 * These ~200 venues live in `src/lib/__fixtures__/global-venues.ts` and are
 * loaded lazily. They aren't currently imported by any consumer in the app
 * tree — we keep this wrapper so future feature work can opt-in via
 * `loadGlobalVenueFixtures()` without bringing back the bundle bloat by
 * accident.
 */

/** Lazy-loaded global venue list. Empty in production. */
export let GLOBAL_EXPANSION_VENUES: Venue[] = []

/** International city centres. Also lazy — this is only used alongside the
 *  venue fixtures, so we keep them paired. */
export let GLOBAL_CITY_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {}

export async function loadGlobalVenueFixtures(): Promise<{
  GLOBAL_EXPANSION_VENUES: Venue[]
  GLOBAL_CITY_LOCATIONS: Record<string, { lat: number; lng: number; name: string }>
}> {
  if (!import.meta.env.DEV) {
    return { GLOBAL_EXPANSION_VENUES: [], GLOBAL_CITY_LOCATIONS: {} }
  }
  const mod = await import('./__fixtures__/global-venues')
  GLOBAL_EXPANSION_VENUES = mod.GLOBAL_EXPANSION_VENUES
  GLOBAL_CITY_LOCATIONS = mod.GLOBAL_CITY_LOCATIONS
  return {
    GLOBAL_EXPANSION_VENUES: mod.GLOBAL_EXPANSION_VENUES,
    GLOBAL_CITY_LOCATIONS: mod.GLOBAL_CITY_LOCATIONS,
  }
}
