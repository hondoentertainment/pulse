import type { Venue } from './types'

/**
 * Prod-safe wrapper around the full Seattle + US mock-venue fixtures.
 *
 * The ~1100-line fixture table lives in `src/lib/__fixtures__/mock-data.ts`
 * and is only loaded in development via `loadMockVenueFixtures()`. In
 * production we ship empty arrays; real venues come from Supabase via
 * `fetchVenuesFromSupabase`.
 *
 * `SIMULATED_USER_LOCATION` / `getSimulatedLocation` are kept inline — they
 * are tiny helpers used at boot to fake a GPS fix in both dev and the
 * "offline demo" prod path, and carry no meaningful size cost.
 */

/** Lazy-loaded full mock venue list. Empty in production. */
export let MOCK_VENUES: Venue[] = []

/** Lazy-loaded Seattle-only subset. Empty in production. */
export let SEATTLE_ONLY_VENUES: Venue[] = []

/**
 * Dev-only: dynamically import the venue fixtures. The fixture module isn't
 * referenced anywhere else, so Rollup drops it from the production bundle.
 */
export async function loadMockVenueFixtures(): Promise<{ MOCK_VENUES: Venue[]; SEATTLE_ONLY_VENUES: Venue[] }> {
  if (!import.meta.env.DEV) return { MOCK_VENUES: [], SEATTLE_ONLY_VENUES: [] }
  const mod = await import('./__fixtures__/mock-data')
  MOCK_VENUES = mod.MOCK_VENUES
  SEATTLE_ONLY_VENUES = mod.SEATTLE_ONLY_VENUES
  return { MOCK_VENUES: mod.MOCK_VENUES, SEATTLE_ONLY_VENUES: mod.SEATTLE_ONLY_VENUES }
}

export const SIMULATED_USER_LOCATION = {
  lat: 47.6145,
  lng: -122.3205,
}

/**
 * Resolve a fake `GeolocationPosition` pinned to Seattle. Used as a fallback
 * when the real Geolocation API denies permission or the user is on a
 * desktop browser without GPS.
 */
export function getSimulatedLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        coords: {
          latitude: SIMULATED_USER_LOCATION.lat,
          longitude: SIMULATED_USER_LOCATION.lng,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)
    }, 100)
  })
}

