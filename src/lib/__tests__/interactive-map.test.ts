import { describe, expect, it } from 'vitest'

import {
  buildVenueRenderPoints,
  calculateBearing,
  clampCenter,
  clusterVenueRenderPoints,
  FIT_MIN_ZOOM,
  getFittedViewport,
  getHeadingDelta,
  getPreviewVenuePoints,
  getTimeAwareCategoryBoost,
  isLocationNearCatalog,
  resolveMapCamera,
  resolveNearMeOrigin,
} from '../interactive-map'
import { LAUNCH_33_CENTER } from '../neighborhood-geo'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: overrides.id || 'venue-1',
    name: overrides.name || 'Test Venue',
    location: overrides.location || { lat: 37.7749, lng: -122.4194, address: 'Test Address' },
    pulseScore: overrides.pulseScore ?? 50,
    ...overrides,
  }
}

describe('clampCenter', () => {
  it('bounds latitude and wraps longitude', () => {
    expect(clampCenter({ lat: 90, lng: 181 })).toEqual({ lat: 85, lng: -179 })
    expect(clampCenter({ lat: -90, lng: -181 })).toEqual({ lat: -85, lng: 179 })
  })
})

describe('calculateBearing and getHeadingDelta', () => {
  it('computes a northward bearing with no heading delta when aligned', () => {
    const bearing = calculateBearing(37.7749, -122.4194, 37.7849, -122.4194)
    expect(bearing).toBeCloseTo(0, 0)
    expect(getHeadingDelta(bearing, 0)).toBeCloseTo(0, 5)
  })
})

describe('getTimeAwareCategoryBoost', () => {
  it('boosts nightlife venues at night', () => {
    const club = makeVenue({ category: 'Nightclub' })
    const cafe = makeVenue({ category: 'Cafe' })
    const night = new Date('2026-03-13T22:00:00.000Z')

    expect(getTimeAwareCategoryBoost(club, night)).toBeGreaterThan(getTimeAwareCategoryBoost(cafe, night))
  })
})

describe('buildVenueRenderPoints', () => {
  it('keeps nearby venues in view and computes distance from the user', () => {
    const venues = [
      makeVenue({ id: 'nearby', location: { lat: 37.775, lng: -122.4194, address: '' } }),
      makeVenue({ id: 'offscreen', location: { lat: 37.9, lng: -122.4194, address: '' } }),
    ]

    const points = buildVenueRenderPoints({
      venues,
      center: { lat: 37.7749, lng: -122.4194 },
      zoom: 1,
      dimensions: { width: 400, height: 300 },
      userLocation: { lat: 37.7749, lng: -122.4194 },
    })

    expect(points.map((point) => point.venue.id)).toEqual(['nearby'])
    expect(points[0].distance).toBeDefined()
    expect(points[0].distance).toBeLessThan(1)
  })
})

describe('clusterVenueRenderPoints', () => {
  it('groups nearby points into a cluster when clustering is enabled', () => {
    const points = [
      { venue: makeVenue({ id: 'a', pulseScore: 30, location: { lat: 37.7749, lng: -122.4194, address: '' } }), x: 100, y: 100 },
      { venue: makeVenue({ id: 'b', pulseScore: 80, location: { lat: 37.775, lng: -122.4193, address: '' } }), x: 112, y: 108 },
      { venue: makeVenue({ id: 'c', pulseScore: 50, location: { lat: 37.8044, lng: -122.2711, address: '' } }), x: 300, y: 280 },
    ]

    const result = clusterVenueRenderPoints(points, 4, true)

    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0].venues).toHaveLength(2)
    expect(result.clusters[0].maxPulseScore).toBe(80)
    expect(result.singles.map((point) => point.venue.id)).toEqual(['c'])
  })
})

describe('getPreviewVenuePoints', () => {
  it('prioritizes the venue that is ahead, fresh, and category-aligned', () => {
    const now = new Date('2026-03-14T04:00:00.000Z')
    const aheadClub = makeVenue({
      id: 'ahead-club',
      category: 'Club',
      pulseScore: 70,
      location: { lat: 37.7849, lng: -122.4194, address: '' },
      lastActivity: now.toISOString(),
    })
    const behindCafe = makeVenue({
      id: 'behind-cafe',
      category: 'Cafe',
      pulseScore: 80,
      location: { lat: 37.7649, lng: -122.4194, address: '' },
      lastActivity: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    })

    const preview = getPreviewVenuePoints({
      points: [
        { venue: aheadClub, x: 200, y: 120 },
        { venue: behindCafe, x: 200, y: 240 },
      ],
      center: { lat: 37.7749, lng: -122.4194 },
      userLocation: { lat: 37.7749, lng: -122.4194 },
      locationHeading: 0,
      now,
      nowMs: now.getTime(),
      limit: 2,
    })

    expect(preview[0].venue.id).toBe('ahead-club')
  })
})

describe('resolveMapCamera', () => {
  it('uses Launch 33 when location is denied and the catalog is empty', () => {
    const camera = resolveMapCamera({ userLocation: null, venues: [] })
    expect(camera.center).toEqual(LAUNCH_33_CENTER)
    expect(camera.followUser).toBe(false)
    expect(camera.reason).toBe('launch33')
  })

  it('centers on the Seattle catalog instead of a far GPS fix', () => {
    const neumos = makeVenue({
      id: 'neumos',
      inventorySource: 'curated-seed',
      seeded: true,
      location: { lat: 47.6145, lng: -122.3205, address: 'Pike' },
    })
    const camera = resolveMapCamera({
      userLocation: { lat: 40.7128, lng: -74.006 },
      venues: [neumos],
    })
    expect(camera.followUser).toBe(false)
    expect(camera.reason).toBe('catalog')
    expect(camera.center.lat).toBeCloseTo(47.6145, 3)
    expect(isLocationNearCatalog({ lat: 40.7128, lng: -74.006 }, [neumos])).toBe(false)
  })

  it('follows the user when they are actually in Seattle', () => {
    const neumos = makeVenue({
      id: 'neumos',
      inventorySource: 'curated-seed',
      location: { lat: 47.6145, lng: -122.3205, address: 'Pike' },
    })
    const here = { lat: 47.615, lng: -122.321 }
    const camera = resolveMapCamera({ userLocation: here, venues: [neumos] })
    expect(camera.followUser).toBe(true)
    expect(camera.reason).toBe('user')
    expect(camera.center.lat).toBeCloseTo(here.lat, 3)
  })

  it('uses Launch 33 as the Near me origin when GPS is off', () => {
    expect(resolveNearMeOrigin(null)).toEqual(LAUNCH_33_CENTER)
    expect(resolveNearMeOrigin({ lat: 47.6, lng: -122.3 })).toEqual({ lat: 47.6, lng: -122.3 })
  })
})

describe('getFittedViewport', () => {
  it('returns a centered viewport for multiple venues', () => {
    const venues = [
      makeVenue({ id: 'west', location: { lat: 37.77, lng: -122.43, address: '' } }),
      makeVenue({ id: 'east', location: { lat: 37.78, lng: -122.41, address: '' } }),
    ]

    const viewport = getFittedViewport(venues, { width: 600, height: 400 })

    expect(viewport).not.toBeNull()
    expect(viewport?.center.lat).toBeCloseTo(37.775, 3)
    expect(viewport?.center.lng).toBeCloseTo(-122.42, 3)
    expect(viewport?.zoom).toBeGreaterThanOrEqual(0.6)
    expect(viewport?.zoom).toBeLessThanOrEqual(4.5)
  })

  it('zooms out past MIN_ZOOM so a 320px heatmap can show Launch 33', () => {
    const venues = [
      makeVenue({ id: 'neumos', location: { lat: 47.6145, lng: -122.3205, address: '' } }),
      makeVenue({ id: 'croc', location: { lat: 47.6162, lng: -122.3488, address: '' } }),
    ]
    const viewport = getFittedViewport(venues, { width: 390, height: 320 }, { minZoom: FIT_MIN_ZOOM })
    expect(viewport).not.toBeNull()
    expect(viewport?.zoom).toBeLessThan(0.6)
    expect(viewport?.zoom).toBeGreaterThanOrEqual(FIT_MIN_ZOOM)
  })
})
