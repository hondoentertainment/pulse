/**
 * Smart Prefetch Engine
 *
 * Determines which venues to prefetch for offline use,
 * builds fetch plans, and manages offline data retrieval.
 */

import type { Venue } from './types'
import type { CacheEntry, CacheInstance, PrefetchStrategy } from './offline-cache'
import { getCacheEntry, setCacheEntry } from './offline-cache'

// --- Types ---

export interface PrefetchTarget {
  venue: Venue
  reason: 'favorite' | 'nearby' | 'trending' | 'followed'
  priority: CacheEntry<unknown>['priority']
  distance?: number
}

export interface PrefetchPlan {
  toFetch: PrefetchTarget[]
  alreadyCached: string[]
  estimatedBytes: number
}

export interface VenueOfflineData {
  venue: Venue
  pulseScore: number
  lastPulseAt: string | null
  cachedAt: number
}

export interface PrefetchParams {
  userLocation: { lat: number; lng: number }
  venues: Venue[]
  favorites: string[]
  followed: string[]
  currentTime: number
}

// --- Constants ---

const VENUE_CACHE_PREFIX = 'venue:'
const VENUE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const ESTIMATED_VENUE_BYTES = 2048 // ~2KB per venue

export const DEFAULT_PREFETCH_STRATEGY: PrefetchStrategy = {
  nearbyRadius: 2, // miles
  maxVenues: 50,
  includeFavorites: true,
  includeFollowed: true,
  refreshInterval: 15 * 60 * 1000, // 15 minutes
}

// --- Distance calculation ---

/**
 * Calculate distance between two lat/lng points in miles using Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// --- Prefetch logic ---

/**
 * Determine which venues should be prefetched, prioritized by importance.
 * Order: favorites first, then followed, then nearby (within radius), then trending.
 */
export function determinePrefetchTargets(params: PrefetchParams): PrefetchTarget[] {
  const { userLocation, venues, favorites, followed } = params
  const targets: PrefetchTarget[] = []
  const seen = new Set<string>()

  // 1. Favorites — critical priority
  for (const venue of venues) {
    if (favorites.includes(venue.id) && !seen.has(venue.id)) {
      seen.add(venue.id)
      targets.push({
        venue,
        reason: 'favorite',
        priority: 'critical',
        distance: haversineDistance(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng
        ),
      })
    }
  }

  // 2. Followed — high priority
  for (const venue of venues) {
    if (followed.includes(venue.id) && !seen.has(venue.id)) {
      seen.add(venue.id)
      targets.push({
        venue,
        reason: 'followed',
        priority: 'high',
        distance: haversineDistance(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng
        ),
      })
    }
  }

  // 3. Nearby — normal priority, sorted by distance
  const nearbyVenues = venues
    .filter((v) => !seen.has(v.id))
    .map((v) => ({
      venue: v,
      distance: haversineDistance(
        userLocation.lat,
        userLocation.lng,
        v.location.lat,
        v.location.lng
      ),
    }))
    .filter((v) => v.distance <= DEFAULT_PREFETCH_STRATEGY.nearbyRadius)
    .sort((a, b) => a.distance - b.distance)

  for (const { venue, distance } of nearbyVenues) {
    if (!seen.has(venue.id)) {
      seen.add(venue.id)
      targets.push({ venue, reason: 'nearby', priority: 'normal', distance })
    }
  }

  // 4. Trending — low priority
  const trending = venues
    .filter((v) => !seen.has(v.id) && v.pulseScore >= 70)
    .sort((a, b) => b.pulseScore - a.pulseScore)

  for (const venue of trending) {
    seen.add(venue.id)
    targets.push({
      venue,
      reason: 'trending',
      priority: 'low',
      distance: haversineDistance(
        userLocation.lat,
        userLocation.lng,
        venue.location.lat,
        venue.location.lng
      ),
    })
  }

  return targets.slice(0, DEFAULT_PREFETCH_STRATEGY.maxVenues)
}

/**
 * Build a plan of what needs fetching vs. what's already cached.
 */
export function buildPrefetchPlan(targets: PrefetchTarget[], cache: CacheInstance): PrefetchPlan {
  const toFetch: PrefetchTarget[] = []
  const alreadyCached: string[] = []

  for (const target of targets) {
    const key = `${VENUE_CACHE_PREFIX}${target.venue.id}`
    const cached = getCacheEntry<VenueOfflineData>(cache, key)
    if (cached) {
      alreadyCached.push(target.venue.id)
    } else {
      toFetch.push(target)
    }
  }

  return {
    toFetch,
    alreadyCached,
    estimatedBytes: toFetch.length * ESTIMATED_VENUE_BYTES,
  }
}

/**
 * Package venue data for offline storage and store it in the cache.
 */
export function prefetchVenueData(
  venue: Venue,
  cache: CacheInstance,
  priority: CacheEntry<unknown>['priority'] = 'normal'
): void {
  const offlineData: VenueOfflineData = {
    venue,
    pulseScore: venue.pulseScore,
    lastPulseAt: venue.lastPulseAt ?? null,
    cachedAt: Date.now(),
  }

  const key = `${VENUE_CACHE_PREFIX}${venue.id}`
  setCacheEntry(cache, key, offlineData, VENUE_TTL_MS, priority)
}

/**
 * Cache all venues within a given radius of a location.
 */
export function prefetchNeighborhood(
  location: { lat: number; lng: number },
  venues: Venue[],
  radius: number,
  cache: CacheInstance
): number {
  let count = 0

  for (const venue of venues) {
    const distance = haversineDistance(
      location.lat,
      location.lng,
      venue.location.lat,
      venue.location.lng
    )
    if (distance <= radius) {
      prefetchVenueData(venue, cache, 'normal')
      count++
    }
  }

  return count
}

/**
 * Check if a cached entry should be refreshed based on the prefetch strategy.
 */
export function shouldRefresh(
  cacheEntry: CacheEntry<unknown>,
  strategy: PrefetchStrategy = DEFAULT_PREFETCH_STRATEGY
): boolean {
  const age = Date.now() - cacheEntry.timestamp
  return age > strategy.refreshInterval
}

/**
 * Retrieve all cached venues, sorted by relevance to user location.
 */
export function getOfflineVenues(
  cache: CacheInstance,
  userLocation: { lat: number; lng: number }
): VenueOfflineData[] {
  const results: (VenueOfflineData & { distance: number })[] = []

  for (const [key, entry] of cache.manifest.entries) {
    if (!key.startsWith(VENUE_CACHE_PREFIX)) continue
    if (Date.now() > entry.expiresAt) continue

    const data = entry.data as VenueOfflineData
    if (!data.venue) continue

    const distance = haversineDistance(
      userLocation.lat,
      userLocation.lng,
      data.venue.location.lat,
      data.venue.location.lng
    )
    results.push({ ...data, distance })
  }

  // Sort by distance (closest first), then by pulse score (highest first)
  results.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) < 0.1) {
      return b.pulseScore - a.pulseScore
    }
    return a.distance - b.distance
  })

  return results
}

export { VENUE_CACHE_PREFIX, VENUE_TTL_MS }
