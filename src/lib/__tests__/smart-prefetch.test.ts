import { describe, it, expect, beforeEach } from 'vitest'
import type { Venue } from '../types'
import { createCache, setCacheEntry } from '../offline-cache'
import type { CacheInstance } from '../offline-cache'
import {
  determinePrefetchTargets,
  buildPrefetchPlan,
  prefetchVenueData,
  prefetchNeighborhood,
  shouldRefresh,
  getOfflineVenues,
  haversineDistance,
  VENUE_CACHE_PREFIX,
  DEFAULT_PREFETCH_STRATEGY,
} from '../smart-prefetch'
import type { VenueOfflineData } from '../smart-prefetch'

// --- Helpers ---

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Bar',
    location: { lat: 47.6, lng: -122.3, address: '123 Main St' },
    pulseScore: 50,
    ...overrides,
  }
}

const userLocation = { lat: 47.6, lng: -122.3 }

let cache: CacheInstance

beforeEach(() => {
  cache = createCache()
})

// --- Tests ---

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(47.6, -122.3, 47.6, -122.3)).toBe(0)
  })

  it('computes approximate distance', () => {
    // ~0.07 miles between these two close points
    const dist = haversineDistance(47.6, -122.3, 47.601, -122.3)
    expect(dist).toBeGreaterThan(0)
    expect(dist).toBeLessThan(1)
  })
})

describe('determinePrefetchTargets', () => {
  it('prioritizes favorites first', () => {
    const venues = [
      makeVenue({ id: 'fav1', pulseScore: 30 }),
      makeVenue({ id: 'nearby1', pulseScore: 90 }),
    ]

    const targets = determinePrefetchTargets({
      userLocation,
      venues,
      favorites: ['fav1'],
      followed: [],
      currentTime: Date.now(),
    })

    expect(targets[0].venue.id).toBe('fav1')
    expect(targets[0].reason).toBe('favorite')
    expect(targets[0].priority).toBe('critical')
  })

  it('places followed venues after favorites', () => {
    const venues = [
      makeVenue({ id: 'fav1' }),
      makeVenue({ id: 'followed1' }),
    ]

    const targets = determinePrefetchTargets({
      userLocation,
      venues,
      favorites: ['fav1'],
      followed: ['followed1'],
      currentTime: Date.now(),
    })

    expect(targets[0].reason).toBe('favorite')
    expect(targets[1].reason).toBe('followed')
    expect(targets[1].priority).toBe('high')
  })

  it('includes nearby venues sorted by distance', () => {
    const venues = [
      makeVenue({ id: 'far', location: { lat: 47.61, lng: -122.3, address: 'far' } }),
      makeVenue({ id: 'close', location: { lat: 47.601, lng: -122.3, address: 'close' } }),
    ]

    const targets = determinePrefetchTargets({
      userLocation,
      venues,
      favorites: [],
      followed: [],
      currentTime: Date.now(),
    })

    const nearbyTargets = targets.filter((t) => t.reason === 'nearby')
    expect(nearbyTargets.length).toBeGreaterThanOrEqual(1)
    if (nearbyTargets.length >= 2) {
      expect(nearbyTargets[0].distance!).toBeLessThanOrEqual(nearbyTargets[1].distance!)
    }
  })

  it('includes trending venues (pulseScore >= 70)', () => {
    const venues = [
      makeVenue({
        id: 'trending1',
        pulseScore: 85,
        location: { lat: 50.0, lng: -100.0, address: 'far away' }, // far from user
      }),
      makeVenue({
        id: 'lowscore',
        pulseScore: 30,
        location: { lat: 50.0, lng: -100.0, address: 'far away' },
      }),
    ]

    const targets = determinePrefetchTargets({
      userLocation,
      venues,
      favorites: [],
      followed: [],
      currentTime: Date.now(),
    })

    const trending = targets.filter((t) => t.reason === 'trending')
    expect(trending.length).toBe(1)
    expect(trending[0].venue.id).toBe('trending1')
    expect(trending[0].priority).toBe('low')
  })

  it('does not duplicate venues across categories', () => {
    const venues = [makeVenue({ id: 'v1', pulseScore: 90 })]

    const targets = determinePrefetchTargets({
      userLocation,
      venues,
      favorites: ['v1'],
      followed: ['v1'],
      currentTime: Date.now(),
    })

    // Should appear only once as favorite
    expect(targets.filter((t) => t.venue.id === 'v1').length).toBe(1)
    expect(targets[0].reason).toBe('favorite')
  })
})

describe('buildPrefetchPlan', () => {
  it('skips already-cached items', () => {
    const venue = makeVenue({ id: 'cached1' })
    prefetchVenueData(venue, cache, 'normal')

    const targets = [
      { venue, reason: 'favorite' as const, priority: 'critical' as const },
      { venue: makeVenue({ id: 'uncached1' }), reason: 'nearby' as const, priority: 'normal' as const },
    ]

    const plan = buildPrefetchPlan(targets, cache)
    expect(plan.alreadyCached).toContain('cached1')
    expect(plan.toFetch.length).toBe(1)
    expect(plan.toFetch[0].venue.id).toBe('uncached1')
  })

  it('estimates bytes for fetch plan', () => {
    const targets = [
      { venue: makeVenue({ id: 'v1' }), reason: 'nearby' as const, priority: 'normal' as const },
      { venue: makeVenue({ id: 'v2' }), reason: 'nearby' as const, priority: 'normal' as const },
    ]

    const plan = buildPrefetchPlan(targets, cache)
    expect(plan.estimatedBytes).toBeGreaterThan(0)
    expect(plan.toFetch.length).toBe(2)
  })
})

describe('prefetchVenueData', () => {
  it('stores venue data in cache', () => {
    const venue = makeVenue({ id: 'v1', pulseScore: 72 })
    prefetchVenueData(venue, cache, 'high')

    const key = `${VENUE_CACHE_PREFIX}v1`
    const entry = cache.manifest.entries.get(key)
    expect(entry).toBeDefined()
    expect(entry?.priority).toBe('high')

    const data = entry?.data as VenueOfflineData
    expect(data.venue.id).toBe('v1')
    expect(data.pulseScore).toBe(72)
    expect(data.cachedAt).toBeGreaterThan(0)
  })
})

describe('prefetchNeighborhood', () => {
  it('caches all venues within radius', () => {
    const venues = [
      makeVenue({ id: 'close', location: { lat: 47.601, lng: -122.3, address: 'close' } }),
      makeVenue({ id: 'far', location: { lat: 50.0, lng: -100.0, address: 'far' } }),
    ]

    const count = prefetchNeighborhood(userLocation, venues, 1, cache)
    expect(count).toBe(1)
    expect(cache.manifest.entries.has(`${VENUE_CACHE_PREFIX}close`)).toBe(true)
    expect(cache.manifest.entries.has(`${VENUE_CACHE_PREFIX}far`)).toBe(false)
  })
})

describe('shouldRefresh', () => {
  it('returns true if entry is older than refresh interval', () => {
    const entry = {
      data: 'test',
      timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      expiresAt: Date.now() + 60_000,
      priority: 'normal' as const,
    }
    expect(shouldRefresh(entry)).toBe(true)
  })

  it('returns false if entry is fresh', () => {
    const entry = {
      data: 'test',
      timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
      expiresAt: Date.now() + 60_000,
      priority: 'normal' as const,
    }
    expect(shouldRefresh(entry)).toBe(false)
  })

  it('respects custom strategy refresh interval', () => {
    const entry = {
      data: 'test',
      timestamp: Date.now() - 2000, // 2 seconds ago
      expiresAt: Date.now() + 60_000,
      priority: 'normal' as const,
    }
    // 1-second refresh interval
    expect(shouldRefresh(entry, { ...DEFAULT_PREFETCH_STRATEGY, refreshInterval: 1000 })).toBe(true)
  })
})

describe('getOfflineVenues', () => {
  it('returns cached venues sorted by distance', () => {
    const close = makeVenue({ id: 'close', location: { lat: 47.601, lng: -122.3, address: 'close' } })
    const far = makeVenue({ id: 'far', location: { lat: 47.62, lng: -122.3, address: 'far' } })

    prefetchVenueData(far, cache, 'normal')
    prefetchVenueData(close, cache, 'normal')

    const results = getOfflineVenues(cache, userLocation)
    expect(results.length).toBe(2)
    expect(results[0].venue.id).toBe('close')
    expect(results[1].venue.id).toBe('far')
  })

  it('excludes expired entries', () => {
    const venue = makeVenue({ id: 'v1' })
    const key = `${VENUE_CACHE_PREFIX}v1`
    setCacheEntry(cache, key, { venue, pulseScore: 50, lastPulseAt: null, cachedAt: Date.now() } satisfies VenueOfflineData, 1, 'normal')

    const start = Date.now()
    while (Date.now() - start < 5) { /* spin */ }

    const results = getOfflineVenues(cache, userLocation)
    expect(results.length).toBe(0)
  })

  it('returns empty array for empty cache', () => {
    expect(getOfflineVenues(cache, userLocation)).toEqual([])
  })

  it('sorts by pulse score when distances are similar', () => {
    const v1 = makeVenue({ id: 'v1', pulseScore: 90, location: { lat: 47.6001, lng: -122.3, address: 'a' } })
    const v2 = makeVenue({ id: 'v2', pulseScore: 40, location: { lat: 47.6001, lng: -122.3, address: 'b' } })

    prefetchVenueData(v2, cache, 'normal')
    prefetchVenueData(v1, cache, 'normal')

    const results = getOfflineVenues(cache, userLocation)
    expect(results[0].venue.id).toBe('v1') // higher score
  })
})
