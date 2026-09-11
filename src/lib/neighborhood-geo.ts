/**
 * Infer a Seattle neighborhood from lat/lng (or a saved preference).
 * Soft boxes only — never invent venues. Unknown points fall back to
 * Launch 33 / last city rather than a fake hood.
 */

export const LAST_NEIGHBORHOOD_STORAGE_KEY = 'pulse_last_neighborhood_v1'
export const LAST_CITY_STORAGE_KEY = 'pulse_last_city_v1'
export const DEFAULT_LAUNCH_NEIGHBORHOOD = 'Capitol Hill'
export const DEFAULT_LAUNCH_CITY = 'Seattle'

/** Capitol Hill Launch 33 — Neumos / Pike-Pine. Used when GPS is off. */
export const LAUNCH_33_CENTER = { lat: 47.6145, lng: -122.3205 }
/** Downtown Seattle nightlife cluster — last-city fallback. */
export const DOWNTOWN_SEATTLE = { lat: 47.6062, lng: -122.3321 }

export interface GeoBox {
  name: string
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/** Real Seattle nightlife clusters that overlap the Launch 33 catalog. */
export const SEATTLE_NEIGHBORHOOD_BOXES: readonly GeoBox[] = [
  { name: 'Capitol Hill', minLat: 47.605, maxLat: 47.632, minLng: -122.332, maxLng: -122.305 },
  { name: 'Belltown', minLat: 47.608, maxLat: 47.622, minLng: -122.356, maxLng: -122.338 },
  { name: 'Downtown', minLat: 47.600, maxLat: 47.615, minLng: -122.345, maxLng: -122.325 },
  { name: 'Fremont', minLat: 47.645, maxLat: 47.662, minLng: -122.360, maxLng: -122.340 },
  { name: 'Ballard', minLat: 47.660, maxLat: 47.682, minLng: -122.400, maxLng: -122.365 },
  { name: 'Queen Anne', minLat: 47.620, maxLat: 47.647, minLng: -122.368, maxLng: -122.345 },
  { name: 'South Lake Union', minLat: 47.615, maxLat: 47.632, minLng: -122.345, maxLng: -122.328 },
  { name: 'University District', minLat: 47.655, maxLat: 47.672, minLng: -122.325, maxLng: -122.298 },
  { name: 'Pioneer Square', minLat: 47.595, maxLat: 47.605, minLng: -122.340, maxLng: -122.325 },
  { name: 'International District', minLat: 47.595, maxLat: 47.605, minLng: -122.330, maxLng: -122.312 },
  { name: 'Georgetown', minLat: 47.540, maxLat: 47.560, minLng: -122.335, maxLng: -122.310 },
  { name: 'West Seattle', minLat: 47.550, maxLat: 47.590, minLng: -122.410, maxLng: -122.370 },
]

export function inferNeighborhoodFromGeo(
  location: { lat: number; lng: number } | null | undefined,
): string | null {
  if (!location) return null
  const { lat, lng } = location
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  for (const box of SEATTLE_NEIGHBORHOOD_BOXES) {
    if (lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng) {
      return box.name
    }
  }
  return null
}

export function readSavedNeighborhood(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): string | null {
  try {
    const value = store?.getItem(LAST_NEIGHBORHOOD_STORAGE_KEY)?.trim()
    return value || null
  } catch {
    return null
  }
}

export function readSavedCity(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): string | null {
  try {
    const value = store?.getItem(LAST_CITY_STORAGE_KEY)?.trim()
    return value || null
  } catch {
    return null
  }
}

export function persistHomePlace(
  input: { neighborhood?: string | null; city?: string | null },
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  try {
    if (input.neighborhood?.trim()) {
      store?.setItem(LAST_NEIGHBORHOOD_STORAGE_KEY, input.neighborhood.trim())
    }
    if (input.city?.trim()) {
      store?.setItem(LAST_CITY_STORAGE_KEY, input.city.trim())
    }
  } catch {
    /* ignore quota */
  }
}

/**
 * Soft fallback when geolocation is denied: last saved hood, then
 * Launch 33 Capitol Hill / Seattle — never an invented city.
 */
export function resolveNeighborhoodFallback(input: {
  inferred?: string | null
  savedNeighborhood?: string | null
  savedCity?: string | null
  venueNeighborhood?: string | null
} = {}): string {
  return (
    input.inferred?.trim()
    || input.savedNeighborhood?.trim()
    || input.venueNeighborhood?.trim()
    || DEFAULT_LAUNCH_NEIGHBORHOOD
  )
}
