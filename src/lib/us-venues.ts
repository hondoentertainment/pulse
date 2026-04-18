import type { Venue } from './types'

/**
 * Prod-safe wrapper around the full US venue fixtures.
 *
 * The 500-line fixture table lives in `src/lib/__fixtures__/us-venues.ts` and
 * is only loaded in development via `loadUSVenueFixtures()`. In production we
 * ship empty arrays; real venues come from Supabase via `fetchVenuesFromSupabase`.
 *
 * `US_CITY_LOCATIONS` (~1 KB) stays inline because it's small and is rendered
 * by `SettingsPage` even in prod (it powers the "simulate being in a different
 * city" city-switcher chips).
 */

/** Lazy-loaded full US venue list. Empty in production. */
export let US_EXPANSION_VENUES: Venue[] = []

/**
 * Load the full venue fixture table at runtime. Only call this in DEV — in
 * production this short-circuits and returns an empty array.
 */
export async function loadUSVenueFixtures(): Promise<Venue[]> {
  if (!import.meta.env.DEV) return []
  const mod = await import('./__fixtures__/us-venues')
  US_EXPANSION_VENUES = mod.US_EXPANSION_VENUES
  return mod.US_EXPANSION_VENUES
}

/**
 * Major US city center coordinates for the simulated-location city switcher.
 *
 * Kept in the wrapper (not in fixtures) because it's tiny and used in prod.
 */
export const US_CITY_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  seattle: { lat: 47.6145, lng: -122.3205, name: 'Seattle, WA' },
  nyc: { lat: 40.7128, lng: -74.0060, name: 'New York, NY' },
  la: { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
  chicago: { lat: 41.8781, lng: -87.6298, name: 'Chicago, IL' },
  miami: { lat: 25.7617, lng: -80.1918, name: 'Miami, FL' },
  austin: { lat: 30.2672, lng: -97.7431, name: 'Austin, TX' },
  nashville: { lat: 36.1627, lng: -86.7816, name: 'Nashville, TN' },
  sf: { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA' },
  denver: { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
  atlanta: { lat: 33.7490, lng: -84.3880, name: 'Atlanta, GA' },
  nola: { lat: 29.9511, lng: -90.0715, name: 'New Orleans, LA' },
  portland: { lat: 45.5152, lng: -122.6784, name: 'Portland, OR' },
  vegas: { lat: 36.1699, lng: -115.1398, name: 'Las Vegas, NV' },
  boston: { lat: 42.3601, lng: -71.0589, name: 'Boston, MA' },
  minneapolis: { lat: 44.9778, lng: -93.2650, name: 'Minneapolis, MN' },
  philly: { lat: 39.9526, lng: -75.1652, name: 'Philadelphia, PA' },
  dc: { lat: 38.9072, lng: -77.0369, name: 'Washington, DC' },
  sandiego: { lat: 32.7157, lng: -117.1611, name: 'San Diego, CA' },
  houston: { lat: 29.7604, lng: -95.3698, name: 'Houston, TX' },
  detroit: { lat: 42.3314, lng: -83.0458, name: 'Detroit, MI' },
  phoenix: { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
  dallas: { lat: 32.7767, lng: -96.7970, name: 'Dallas, TX' },
  slc: { lat: 40.7608, lng: -111.8910, name: 'Salt Lake City, UT' },
  tampa: { lat: 27.9506, lng: -82.4572, name: 'Tampa, FL' },
  charlotte: { lat: 35.2271, lng: -80.8431, name: 'Charlotte, NC' },
  pittsburgh: { lat: 40.4406, lng: -79.9959, name: 'Pittsburgh, PA' },
  columbus: { lat: 39.9612, lng: -82.9988, name: 'Columbus, OH' },
  kansascity: { lat: 39.0997, lng: -94.5786, name: 'Kansas City, MO' },
  milwaukee: { lat: 43.0389, lng: -87.9065, name: 'Milwaukee, WI' },
  honolulu: { lat: 21.3069, lng: -157.8583, name: 'Honolulu, HI' },
  anchorage: { lat: 61.2181, lng: -149.9003, name: 'Anchorage, AK' },
}

/**
 * Haversine distance: find the nearest `US_CITY_LOCATIONS` entry to a point.
 */
export function getNearestCity(lat: number, lng: number): { key: string; name: string; distance: number } {
  let nearest = { key: 'seattle', name: 'Seattle, WA', distance: Infinity }

  for (const [key, city] of Object.entries(US_CITY_LOCATIONS)) {
    const R = 3958.8
    const dLat = ((city.lat - lat) * Math.PI) / 180
    const dLng = ((city.lng - lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) * Math.cos((city.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    if (distance < nearest.distance) {
      nearest = { key, name: city.name, distance }
    }
  }

  return nearest
}

/**
 * DEV-only loader for US expansion venues. Returns empty array outside
 * of dev builds so production bundles don't include fixture data.
 */
export function loadUSVenueFixtures(): Venue[] {
  if (!import.meta.env.DEV) return []
  return US_EXPANSION_VENUES
}
