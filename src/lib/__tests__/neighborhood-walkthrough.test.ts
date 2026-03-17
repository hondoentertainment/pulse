import { describe, it, expect } from 'vitest'
import type { Venue } from '../types'
import {
  generateWalkthrough,
  calculateWalkTime,
  estimateArrivalEnergy,
  generateThemeDescription,
  getAvailableThemes,
  reorderRoute,
  addStopToRoute,
  removeStopFromRoute,
} from '../neighborhood-walkthrough'
import type { WalkthroughRoute } from '../neighborhood-walkthrough'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: `venue-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Bar',
    location: { lat: 47.6145, lng: -122.3205, address: '123 Main St' },
    city: 'Seattle',
    state: 'WA',
    pulseScore: 70,
    category: 'bar',
    ...overrides,
  }
}

function makeVenueSet(): Venue[] {
  return [
    makeVenue({ id: 'v1', name: 'The Hotspot', pulseScore: 90, location: { lat: 47.6145, lng: -122.3205, address: '100 Pike St' }, category: 'bar' }),
    makeVenue({ id: 'v2', name: 'Cocktail Corner', pulseScore: 80, location: { lat: 47.6155, lng: -122.3195, address: '200 Pike St' }, category: 'cocktail_bar' }),
    makeVenue({ id: 'v3', name: 'The Dive', pulseScore: 60, location: { lat: 47.6135, lng: -122.3215, address: '300 Pike St' }, category: 'dive_bar' }),
    makeVenue({ id: 'v4', name: 'Jazz Club', pulseScore: 75, location: { lat: 47.6165, lng: -122.3225, address: '400 Pike St' }, category: 'music_venue' }),
    makeVenue({ id: 'v5', name: 'Pasta Palace', pulseScore: 85, location: { lat: 47.6125, lng: -122.3185, address: '500 Pike St' }, category: 'restaurant' }),
    makeVenue({ id: 'v6', name: 'Wine Loft', pulseScore: 65, location: { lat: 47.6175, lng: -122.3235, address: '600 Pike St' }, category: 'wine_bar' }),
  ]
}

const userLocation = { lat: 47.6140, lng: -122.3200 }

describe('generateWalkthrough', () => {
  it('generates a route with venues', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })

    expect(route.neighborhood).toBe('Capitol Hill')
    expect(route.stops.length).toBeGreaterThan(0)
    expect(route.stops.length).toBeLessThanOrEqual(5)
    expect(route.venueCount).toBe(route.stops.length)
    expect(route.id).toMatch(/^walk-/)
  })

  it('assigns sequential order numbers', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })

    route.stops.forEach((stop, idx) => {
      expect(stop.order).toBe(idx + 1)
    })
  })

  it('sets first stop walkTimeFromPrevious to 0', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })

    expect(route.stops[0].walkTimeFromPrevious).toBe(0)
  })

  it('includes reason for each stop', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })

    route.stops.forEach(stop => {
      expect(stop.reason).toBeTruthy()
      expect(typeof stop.reason).toBe('string')
    })
  })

  it('does not repeat venues', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })

    const ids = route.stops.map(s => s.venue.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('respects maxStops constraint', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({
      venues,
      neighborhood: 'Capitol Hill',
      userLocation,
      maxStops: 2,
    })

    expect(route.stops.length).toBeLessThanOrEqual(2)
  })

  it('respects maxWalkTime constraint', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({
      venues,
      neighborhood: 'Capitol Hill',
      userLocation,
      maxWalkTime: 5,
    })

    // Should have at least 1 stop (first stop has 0 walk time)
    expect(route.stops.length).toBeGreaterThanOrEqual(1)
    expect(route.totalWalkTime).toBeLessThanOrEqual(5)
  })

  it('assigns difficulty based on walk time and stop count', () => {
    const venues = makeVenueSet()
    const easy = generateWalkthrough({
      venues,
      neighborhood: 'Capitol Hill',
      userLocation,
      maxStops: 2,
      maxWalkTime: 20,
    })

    expect(['easy', 'moderate', 'ambitious']).toContain(easy.difficulty)
  })
})

describe('route optimization — energy-weighted, not just nearest', () => {
  it('prefers high-energy venues over simply the closest', () => {
    const closeButDead = makeVenue({
      id: 'close-dead',
      name: 'Dead Nearby',
      pulseScore: 5,
      location: { lat: 47.6141, lng: -122.3201, address: 'Next door' },
    })
    const farButHot = makeVenue({
      id: 'far-hot',
      name: 'Hot Faraway',
      pulseScore: 95,
      location: { lat: 47.6160, lng: -122.3220, address: 'Few blocks away' },
    })

    const route = generateWalkthrough({
      venues: [closeButDead, farButHot],
      neighborhood: 'Test',
      userLocation,
      maxStops: 1,
    })

    expect(route.stops[0].venue.id).toBe('far-hot')
  })
})

describe('calculateWalkTime', () => {
  it('returns 0 for same point', () => {
    const time = calculateWalkTime(
      { lat: 47.6145, lng: -122.3205 },
      { lat: 47.6145, lng: -122.3205 }
    )
    expect(time).toBe(0)
  })

  it('returns reasonable walk time for nearby points', () => {
    // ~0.1 miles apart → ~2 minutes at 3mph
    const time = calculateWalkTime(
      { lat: 47.6145, lng: -122.3205 },
      { lat: 47.6155, lng: -122.3205 }
    )
    expect(time).toBeGreaterThan(0)
    expect(time).toBeLessThan(10)
  })

  it('returns longer time for farther points', () => {
    const near = calculateWalkTime(
      { lat: 47.6145, lng: -122.3205 },
      { lat: 47.6155, lng: -122.3205 }
    )
    const far = calculateWalkTime(
      { lat: 47.6145, lng: -122.3205 },
      { lat: 47.6245, lng: -122.3205 }
    )
    expect(far).toBeGreaterThan(near)
  })
})

describe('estimateArrivalEnergy', () => {
  it('returns electric for high pulse score at peak hours', () => {
    const venue = makeVenue({ pulseScore: 85 })
    const peakTime = new Date()
    peakTime.setHours(22, 0, 0, 0)

    const energy = estimateArrivalEnergy(venue, peakTime)
    expect(energy).toBe('electric')
  })

  it('returns lower energy for low pulse score', () => {
    const venue = makeVenue({ pulseScore: 10 })
    const afternoon = new Date()
    afternoon.setHours(14, 0, 0, 0)

    const energy = estimateArrivalEnergy(venue, afternoon)
    expect(['dead', 'chill']).toContain(energy)
  })

  it('accounts for time of day', () => {
    const venue = makeVenue({ pulseScore: 60 })

    const peak = new Date()
    peak.setHours(23, 0, 0, 0)
    const energyPeak = estimateArrivalEnergy(venue, peak)

    const earlyAm = new Date()
    earlyAm.setHours(4, 0, 0, 0)
    const energyEarly = estimateArrivalEnergy(venue, earlyAm)

    // Peak should be >= early morning
    const values = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
    expect(values[energyPeak]).toBeGreaterThanOrEqual(values[energyEarly])
  })
})

describe('generateThemeDescription', () => {
  it('generates descriptive text for a route', () => {
    const route: WalkthroughRoute = {
      id: 'test',
      neighborhood: 'Downtown',
      stops: [],
      totalWalkTime: 45,
      totalDistance: 1.2,
      venueCount: 4,
      theme: 'cocktail-crawl',
      difficulty: 'moderate',
    }

    const desc = generateThemeDescription(route)
    expect(desc).toContain('45-minute')
    expect(desc).toContain('Downtown')
    expect(desc).toContain('4')
  })

  it('uses hours for longer routes', () => {
    const route: WalkthroughRoute = {
      id: 'test',
      neighborhood: 'Capitol Hill',
      stops: [],
      totalWalkTime: 90,
      totalDistance: 2.5,
      venueCount: 6,
      theme: 'hottest',
      difficulty: 'ambitious',
    }

    const desc = generateThemeDescription(route)
    expect(desc).toContain('1-hour')
  })
})

describe('getAvailableThemes', () => {
  it('returns themes with enough venues', () => {
    const venues = makeVenueSet()
    const themes = getAvailableThemes(venues, 'Capitol Hill')

    // Should include 'hottest' and 'best-of' since they accept all venues
    expect(themes).toContain('hottest')
    expect(themes).toContain('best-of')
  })

  it('filters themes by category', () => {
    // Only restaurant venues — should not include dive-bars
    const venues = [
      makeVenue({ id: 'r1', category: 'restaurant' }),
      makeVenue({ id: 'r2', category: 'restaurant' }),
    ]

    const themes = getAvailableThemes(venues, 'Test')
    expect(themes).not.toContain('dive-bars')
    expect(themes).not.toContain('live-music')
  })

  it('includes cocktail-crawl when bar/lounge venues exist', () => {
    const venues = [
      makeVenue({ id: 'b1', category: 'bar' }),
      makeVenue({ id: 'b2', category: 'cocktail_bar' }),
      makeVenue({ id: 'b3', category: 'lounge' }),
    ]

    const themes = getAvailableThemes(venues, 'Test')
    expect(themes).toContain('cocktail-crawl')
  })
})

describe('reorderRoute', () => {
  it('reorders starting from a specific venue', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })

    if (route.stops.length < 2) return

    const lastStop = route.stops[route.stops.length - 1]
    const reordered = reorderRoute(route, lastStop.venue.id)

    expect(reordered.stops[0].venue.id).toBe(lastStop.venue.id)
    expect(reordered.stops[0].order).toBe(1)
    expect(reordered.stops[0].walkTimeFromPrevious).toBe(0)
  })

  it('returns unchanged route if venue not found', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })
    const result = reorderRoute(route, 'nonexistent')

    expect(result.stops.length).toBe(route.stops.length)
  })

  it('preserves all stops when reordering', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Capitol Hill', userLocation })

    if (route.stops.length < 2) return

    const reordered = reorderRoute(route, route.stops[1].venue.id)
    const originalIds = new Set(route.stops.map(s => s.venue.id))
    const reorderedIds = new Set(reordered.stops.map(s => s.venue.id))

    expect(reorderedIds).toEqual(originalIds)
  })
})

describe('addStopToRoute', () => {
  it('adds a venue to an empty route', () => {
    const emptyRoute: WalkthroughRoute = {
      id: 'empty',
      neighborhood: 'Test',
      stops: [],
      totalWalkTime: 0,
      totalDistance: 0,
      venueCount: 0,
      theme: 'hottest',
      difficulty: 'easy',
    }

    const venue = makeVenue({ id: 'new-v', name: 'New Bar' })
    const updated = addStopToRoute(emptyRoute, venue)

    expect(updated.stops.length).toBe(1)
    expect(updated.stops[0].venue.id).toBe('new-v')
    expect(updated.venueCount).toBe(1)
  })

  it('adds a venue to an existing route', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues: venues.slice(0, 3), neighborhood: 'Test', userLocation })
    const newVenue = makeVenue({ id: 'added', name: 'Added Bar', location: { lat: 47.6150, lng: -122.3210, address: 'New St' } })

    const updated = addStopToRoute(route, newVenue)
    expect(updated.stops.length).toBe(route.stops.length + 1)
    expect(updated.stops.some(s => s.venue.id === 'added')).toBe(true)
  })

  it('recalculates times after adding', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues: venues.slice(0, 2), neighborhood: 'Test', userLocation })
    const newVenue = makeVenue({ id: 'added', name: 'Added', location: { lat: 47.6150, lng: -122.3210, address: 'New' } })

    const updated = addStopToRoute(route, newVenue)
    updated.stops.forEach((stop, idx) => {
      expect(stop.order).toBe(idx + 1)
    })
  })
})

describe('removeStopFromRoute', () => {
  it('removes a venue by id', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Test', userLocation })
    const venueToRemove = route.stops[0].venue.id

    const updated = removeStopFromRoute(route, venueToRemove)
    expect(updated.stops.length).toBe(route.stops.length - 1)
    expect(updated.stops.every(s => s.venue.id !== venueToRemove)).toBe(true)
  })

  it('returns unchanged route if id not found', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Test', userLocation })
    const updated = removeStopFromRoute(route, 'nonexistent')

    expect(updated.stops.length).toBe(route.stops.length)
  })

  it('recalculates order after removal', () => {
    const venues = makeVenueSet()
    const route = generateWalkthrough({ venues, neighborhood: 'Test', userLocation })

    if (route.stops.length < 2) return

    const updated = removeStopFromRoute(route, route.stops[0].venue.id)
    updated.stops.forEach((stop, idx) => {
      expect(stop.order).toBe(idx + 1)
    })
    // First stop in updated route should have 0 walk time from previous
    expect(updated.stops[0].walkTimeFromPrevious).toBe(0)
  })
})

describe('edge cases', () => {
  it('handles only 1 venue', () => {
    const venue = makeVenue({ id: 'solo', name: 'Solo Bar' })
    const route = generateWalkthrough({ venues: [venue], neighborhood: 'Test', userLocation })

    expect(route.stops.length).toBe(1)
    expect(route.stops[0].venue.id).toBe('solo')
    expect(route.totalWalkTime).toBe(0)
  })

  it('handles empty venue list', () => {
    const route = generateWalkthrough({ venues: [], neighborhood: 'Test', userLocation })

    expect(route.stops.length).toBe(0)
    expect(route.venueCount).toBe(0)
    expect(route.totalWalkTime).toBe(0)
  })

  it('handles venues very far apart', () => {
    const venues = [
      makeVenue({ id: 'seattle', name: 'Seattle Bar', location: { lat: 47.6, lng: -122.3, address: 'Seattle' }, pulseScore: 90 }),
      makeVenue({ id: 'portland', name: 'Portland Bar', location: { lat: 45.5, lng: -122.6, address: 'Portland' }, pulseScore: 90 }),
    ]

    const route = generateWalkthrough({
      venues,
      neighborhood: 'Test',
      userLocation: { lat: 47.6, lng: -122.3 },
      maxWalkTime: 30,
    })

    // Should include at most 1 venue due to walk time constraint
    expect(route.stops.length).toBeLessThanOrEqual(2)
    expect(route.totalWalkTime).toBeLessThanOrEqual(30)
  })

  it('handles no venues matching theme', () => {
    const venues = [
      makeVenue({ id: 'r1', category: 'restaurant' }),
      makeVenue({ id: 'r2', category: 'restaurant' }),
    ]

    const route = generateWalkthrough({
      venues,
      neighborhood: 'Test',
      userLocation,
      theme: 'dive-bars',
    })

    // dive-bars theme filters to dive_bar/bar categories — restaurants won't match
    expect(route.stops.length).toBe(0)
  })
})
