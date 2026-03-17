import { describe, expect, it } from 'vitest'

import {
  buildVenueRenderPoints,
  calculateBearing,
  clampCenter,
  clusterVenueRenderPoints,
  getFittedViewport,
  getHeadingDelta,
  getPreviewVenuePoints,
  getTimeAwareCategoryBoost,
} from '../interactive-map'
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
    const night = new Date(2026, 2, 13, 22, 0, 0)

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
      { venue: makeVenue({ id: 'a', pulseScore: 30 }), x: 100, y: 100 },
      { venue: makeVenue({ id: 'b', pulseScore: 80 }), x: 112, y: 108 },
      { venue: makeVenue({ id: 'c', pulseScore: 50 }), x: 300, y: 280 },
    ]

    const result = clusterVenueRenderPoints(points, 0.8, true)

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
})
