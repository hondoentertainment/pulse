import type { Pulse, Venue } from './types'

export interface PrototypeCatalog {
  venues: Venue[]
  pulses: Pulse[]
}

/**
 * Normalize a launched-cities list into a lowercase token set.
 *
 * `VITE_LAUNCHED_CITIES` is documented as `Seattle,WA` and callers are
 * expected to pre-split on comma (see `use-app-state.tsx`), but we also
 * defensively split each entry on comma here — so a caller that forgets to
 * split (or passes the raw env string as a single array element) still gets
 * a usable `seattle` / `wa` token set instead of one literal
 * `"seattle,wa"` string that never matches `venue.city`.
 */
function normalizeLaunchedCities(launchedCities: string[]): Set<string> {
  return new Set(
    launchedCities
      .flatMap((city) => city.split(','))
      .map((city) => city.trim().toLowerCase())
      .filter(Boolean)
  )
}

function buildPreviewPulses(venues: Venue[]): Pulse[] {
  const now = Date.now()
  const previewUsers = ['user-2', 'user-3', 'user-4', 'user-5', 'user-6']
  const photos = [
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=1500&fit=crop',
  ]

  return venues.slice(0, 10).flatMap((venue, index) => {
    const createdAt = new Date(now - (index + 1) * 4 * 60 * 1000).toISOString()
    return [{
      id: `preview-pulse-${venue.id}`,
      userId: previewUsers[index % previewUsers.length],
      venueId: venue.id,
      photos: [photos[index % photos.length]],
      energyRating: index % 3 === 0 ? 'electric' : index % 3 === 1 ? 'buzzing' : 'chill',
      caption: index % 2 === 0 ? 'Packed room, fast line, great set.' : 'Strong crowd and the vibe is still climbing.',
      hashtags: ['live', 'tonight', venue.category?.toLowerCase().replace(/\s+/g, '') ?? 'venue'],
      views: 90 + index * 17,
      reactions: {
        fire: ['user-2', 'user-3'].slice(0, (index % 2) + 1),
        eyes: ['user-4'],
        skull: [],
        lightning: ['user-5'],
      },
      credibilityWeight: 1,
      createdAt,
      expiresAt: new Date(now + 90 * 60 * 1000).toISOString(),
    } satisfies Pulse]
  })
}

/**
 * Prefer the fully-structured `SEATTLE_NIGHTLIFE_CURATED` inventory (PRD
 * P0-4 — hours, dress code, cover charge, price range for every venue) over
 * the legacy `SEATTLE_LAUNCH_VENUES` mock. Any mock venues whose name isn't
 * already covered by the curated set are kept so we don't shrink the
 * catalog while the curated list grows toward full neighborhood coverage.
 */
function mergeCuratedSeattleVenues(curated: Venue[], legacyMock: Venue[]): Venue[] {
  const curatedNames = new Set(curated.map((v) => v.name.toLowerCase().trim()))
  const extraMockVenues = legacyMock.filter((v) => !curatedNames.has(v.name.toLowerCase().trim()))
  return [...curated, ...extraMockVenues]
}

function isSeattleLaunched(launchedCities: string[]): boolean {
  const launchedCitySet = normalizeLaunchedCities(launchedCities)
  if (launchedCitySet.has('seattle')) return true
  return launchedCities.some((city) => city.toLowerCase().includes('seattle'))
}

async function loadCatalogVenues(launchedCities: string[] = []): Promise<Venue[]> {
  // Visual-preview / E2E builds run in production mode (where the dev-only
  // `MOCK_VENUES` table is empty). Load a small deterministic seed instead so
  // previews and Playwright specs have stable venues to work with. The import
  // is statically gated on a build-time env constant, so it is tree-shaken out
  // of real production bundles.
  if (import.meta.env.VITE_VISUAL_PREVIEW === 'true') {
    const { E2E_SEED_VENUES } = await import('./__fixtures__/e2e-seed')
    return E2E_SEED_VENUES
  }

  if (isSeattleLaunched(launchedCities)) {
    const [{ SEATTLE_LAUNCH_VENUES }, { SEATTLE_NIGHTLIFE_CURATED }] = await Promise.all([
      import('./__fixtures__/seattle-launch-seed'),
      import('./seattle-nightlife-catalog'),
    ])
    return mergeCuratedSeattleVenues(SEATTLE_NIGHTLIFE_CURATED, SEATTLE_LAUNCH_VENUES)
  }

  if (import.meta.env.DEV) {
    const { loadMockVenueFixtures } = await import('./mock-data')
    const { MOCK_VENUES } = await loadMockVenueFixtures()
    return MOCK_VENUES
  }

  return []
}

export async function loadPrototypeCatalog(launchedCities: string[] = []): Promise<PrototypeCatalog> {
  const catalogVenues = await loadCatalogVenues(launchedCities)

  const launchedCitySet = normalizeLaunchedCities(launchedCities)
  const filteredVenues = catalogVenues.filter((venue) => {
    if (launchedCitySet.size === 0) return true
    return launchedCitySet.has((venue.city ?? '').toLowerCase())
  })
  const venues = filteredVenues.length > 0 ? filteredVenues : catalogVenues

  return {
    venues,
    pulses:
      import.meta.env.VITE_VISUAL_PREVIEW === 'true' || isSeattleLaunched(launchedCities)
        ? buildPreviewPulses(venues)
        : [],
  }
}

export async function loadSimulatedLocation() {
  const { getSimulatedLocation } = await import('./mock-data')
  return getSimulatedLocation()
}
