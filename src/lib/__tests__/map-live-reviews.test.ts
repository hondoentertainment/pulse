import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import {
  buildMapLiveToast,
  buildVenueActivityMap,
  collectLiveReviewArrivals,
  getSurgingNearbyVenues,
  getVenueMapActivity,
  stampVenuesFromLiveReviews,
} from '../map-live-reviews'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 40,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p-1',
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'electric',
    caption: 'DJ just switched — floor is packed.',
    kind: 'review',
    hasBody: true,
    locationVerified: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('getVenueMapActivity', () => {
  it('keeps quiet venues quiet when there are no reviews', () => {
    const activity = getVenueMapActivity(makeVenue({ pulseScore: 12 }), [])
    expect(activity.liveReviewCount).toBe(0)
    expect(activity.countLabel).toBe('')
    expect(activity.heatScore).toBe(12)
    expect(activity.hasFreshReview).toBe(false)
  })

  it('boosts heatmap from real review volume and latest energy', () => {
    const nowMs = Date.parse('2026-09-10T13:00:00.000Z')
    const venue = makeVenue({ pulseScore: 40 })
    const pulses = [
      makePulse({
        id: 'a',
        energyRating: 'electric',
        createdAt: new Date(nowMs - 2 * 60 * 1000).toISOString(),
      }),
      makePulse({
        id: 'b',
        energyRating: 'buzzing',
        createdAt: new Date(nowMs - 40 * 60 * 1000).toISOString(),
      }),
    ]
    const activity = getVenueMapActivity(venue, pulses, nowMs)
    expect(activity.liveReviewCount).toBe(2)
    expect(activity.countLabel).toBe('2 live reviews · last hour')
    expect(activity.heatScore).toBeGreaterThan(40)
    expect(activity.heatColor).toEqual({ r: 255, g: 45, b: 120 })
  })

  it('still paints heat when pulseScore is 0 but reviews exist', () => {
    const activity = getVenueMapActivity(makeVenue({ pulseScore: 0 }), [makePulse()])
    expect(activity.heatScore).toBeGreaterThan(0)
    expect(activity.liveReviewCount).toBe(1)
  })
})

describe('getSurgingNearbyVenues', () => {
  it('returns only venues with live reviews', () => {
    const neon = makeVenue({ id: 'neon', name: 'Neon Lounge', pulseScore: 90 })
    const barrio = makeVenue({
      id: 'barrio',
      name: 'Barrio',
      pulseScore: 20,
      location: { lat: 47.615, lng: -122.321, address: '2 Pike' },
    })
    const pulses = [
      makePulse({ id: 'r1', venueId: 'barrio' }),
      makePulse({ id: 'r2', venueId: 'barrio' }),
    ]
    const surging = getSurgingNearbyVenues([neon, barrio], pulses)
    expect(surging.map((venue) => venue.id)).toEqual(['barrio'])
  })

  it('drops venues outside the nearby radius', () => {
    const far = makeVenue({
      id: 'far',
      location: { lat: 40.7, lng: -74.0, address: 'NYC' },
    })
    const pulses = [makePulse({ venueId: 'far' })]
    expect(getSurgingNearbyVenues([far], pulses, {
      userLocation: { lat: 47.614, lng: -122.32 },
    })).toEqual([])
  })
})

describe('buildVenueActivityMap', () => {
  it('matches per-venue activity after a single pulse scan', () => {
    const venues = [
      makeVenue({ id: 'venue-1', pulseScore: 40 }),
      makeVenue({ id: 'venue-2', name: 'Barrio', pulseScore: 12 }),
    ]
    const pulses = [
      makePulse({ id: 'a', venueId: 'venue-1' }),
      makePulse({ id: 'b', venueId: 'venue-1', energyRating: 'buzzing' }),
    ]
    const nowMs = Date.now()
    const map = buildVenueActivityMap(venues, pulses, nowMs)
    expect(map.get('venue-1')).toEqual(getVenueMapActivity(venues[0], pulses, nowMs))
    expect(map.get('venue-2')).toEqual(getVenueMapActivity(venues[1], pulses, nowMs))
    expect(map.get('venue-2')?.liveReviewCount).toBe(0)
  })
})

describe('stampVenuesFromLiveReviews', () => {
  it('stamps lastActivity from the newest review only', () => {
    const older = makePulse({
      id: 'old',
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    })
    const newer = makePulse({
      id: 'new',
      createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
    })
    const [updated] = stampVenuesFromLiveReviews([makeVenue()], [older, newer])
    expect(updated.lastActivity).toBe(newer.createdAt)
    expect(updated.lastPulseAt).toBe(newer.createdAt)
    expect(updated.pulseScore).toBe(40)
  })

  it('ignores energy-only pulses', () => {
    const [updated] = stampVenuesFromLiveReviews(
      [makeVenue()],
      [makePulse({ kind: 'pulse', caption: 'check in', hasBody: true })],
    )
    expect(updated.lastActivity).toBeUndefined()
  })

  it('returns the same array when no visible venue matches', () => {
    const venues = [makeVenue({ id: 'visible' })]
    expect(stampVenuesFromLiveReviews(venues, [makePulse({ venueId: 'hidden' })])).toBe(venues)
  })

  it('returns the same array when lastActivity is already stamped', () => {
    const createdAt = new Date().toISOString()
    const venues = [makeVenue({ lastActivity: createdAt, lastPulseAt: createdAt })]
    expect(stampVenuesFromLiveReviews(venues, [makePulse({ createdAt })])).toBe(venues)
  })
})

describe('collectLiveReviewArrivals', () => {
  it('does not toast the first snapshot', () => {
    const pulses = [makePulse()]
    const first = collectLiveReviewArrivals(new Set(), false, pulses, [makeVenue()])
    expect(first.arrivals).toEqual([])
    expect(first.nextPrimed).toBe(true)
    expect(first.nextSeen.has('p-1')).toBe(true)
  })

  it('emits a toast for a new review on a visible venue', () => {
    const venue = makeVenue()
    const existing = makePulse({ id: 'existing' })
    const primed = collectLiveReviewArrivals(new Set(), false, [existing], [venue])
    const incoming = makePulse({ id: 'fresh', caption: 'Line moved fast.' })
    const next = collectLiveReviewArrivals(primed.nextSeen, true, [incoming, existing], [venue])
    expect(next.arrivals).toHaveLength(1)
    expect(next.arrivals[0]).toMatchObject({
      id: 'fresh',
      venueName: 'Neon Lounge',
      snippet: 'Line moved fast.',
    })
  })

  it('skips reviews for venues that are not visible (launch/geo gate)', () => {
    const primed = collectLiveReviewArrivals(new Set(), false, [], [])
    const next = collectLiveReviewArrivals(
      primed.nextSeen,
      true,
      [makePulse({ id: 'hidden' })],
      [],
    )
    expect(next.arrivals).toEqual([])
  })
})

describe('buildMapLiveToast', () => {
  it('uses Live · venue · snippet shape', () => {
    const toast = buildMapLiveToast(makePulse(), makeVenue())
    expect(toast.venueName).toBe('Neon Lounge')
    expect(toast.snippet).toContain('DJ just switched')
    expect(toast.energy).toBe('electric')
  })
})
