import type { Venue } from '../types'

/**
 * Deterministic venue seed for visual-preview and E2E builds.
 *
 * This is intentionally tiny (vs. the ~1100-line dev fixture in
 * `mock-data.ts`) and is only imported when `VITE_VISUAL_PREVIEW === 'true'`,
 * so Rollup tree-shakes it out of real production bundles. Keeping the data
 * fixed means Playwright specs (search, pulse creation, presence) run against
 * stable, predictable venues instead of skipping when no data is present.
 */
export const E2E_SEED_VENUES: Venue[] = [
  {
    id: 'e2e-venue-neon-room',
    name: 'The Neon Room',
    location: { lat: 47.6142, lng: -122.3201, address: '1001 Pike St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    category: 'Bars & Pubs',
    pulseScore: 92,
    seeded: true,
  },
  {
    id: 'e2e-venue-lowlight-lounge',
    name: 'Lowlight Lounge',
    location: { lat: 47.6097, lng: -122.3331, address: '220 Union St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    category: 'Cocktail Bar',
    pulseScore: 84,
    seeded: true,
  },
  {
    id: 'e2e-venue-afterglow',
    name: 'Afterglow Nightclub',
    location: { lat: 47.6155, lng: -122.3456, address: '500 Denny Way, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    category: 'Nightclub',
    pulseScore: 88,
    seeded: true,
  },
  {
    id: 'e2e-venue-harbor-tap',
    name: 'Harbor Tap House',
    location: { lat: 47.6028, lng: -122.3392, address: '88 Yesler Way, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    category: 'Bars & Pubs',
    pulseScore: 76,
    seeded: true,
  },
  {
    id: 'e2e-venue-velvet-stage',
    name: 'Velvet Stage',
    location: { lat: 47.6219, lng: -122.3517, address: '305 Mercer St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    category: 'Live Music',
    pulseScore: 81,
    seeded: true,
  },
  {
    id: 'e2e-venue-skyline-rooftop',
    name: 'Skyline Rooftop',
    location: { lat: 47.6113, lng: -122.3361, address: '1400 6th Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    category: 'Rooftop Bar',
    pulseScore: 90,
    seeded: true,
  },
]
