/**
 * Offline Cache Engine
 *
 * Smart caching with TTL, priority-based LRU eviction,
 * size budgeting, and localStorage persistence.
 */

// --- Types ---

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  priority: 'critical' | 'high' | 'normal' | 'low'
}

export interface CacheManifest {
  entries: Map<string, CacheEntry<unknown>>
  totalSize: number
  lastCleanup: number
}

export interface PrefetchStrategy {
  nearbyRadius: number
  maxVenues: number
  includeFavorites: boolean
  includeFollowed: boolean
  refreshInterval: number
}

export interface CacheStats {
  hitRate: number
  totalEntries: number
  usedBytes: number
  oldestEntry: number | null
}

// --- Constants ---

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const CACHE_STORAGE_KEY = 'pulse_offline_cache'

// --- Cache state ---

interface CacheInstance {
  manifest: CacheManifest
  maxSizeBytes: number
  hits: number
  misses: number
}

/**
 * Initialize a new cache with an optional size limit.
 */
export function createCache(maxSizeBytes: number = DEFAULT_MAX_SIZE_BYTES): CacheInstance {
  return {
    manifest: {
      entries: new Map(),
      totalSize: 0,
      lastCleanup: Date.now(),
    },
    maxSizeBytes,
    hits: 0,
    misses: 0,
  }
}

/**
 * Estimate the byte size of a value by JSON-serializing it.
 */
export function calculateEntrySize(data: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length
  } catch {
    return 0
  }
}

/**
 * Store data in the cache with TTL and priority.
 */
export function setCacheEntry<T>(
  cache: CacheInstance,
  key: string,
  data: T,
  ttlMs: number,
  priority: CacheEntry<T>['priority'] = 'normal'
): void {
  const entrySize = calculateEntrySize(data)

  // Remove existing entry if present (reclaim its size)
  if (cache.manifest.entries.has(key)) {
    const existing = cache.manifest.entries.get(key)!
    cache.manifest.totalSize -= calculateEntrySize(existing.data)
    cache.manifest.entries.delete(key)
  }

  // Evict if needed to fit the new entry
  if (cache.manifest.totalSize + entrySize > cache.maxSizeBytes) {
    evictByPriority(cache, entrySize)
  }

  // If single entry is larger than max, skip storing
  if (entrySize > cache.maxSizeBytes) return

  const now = Date.now()
  const entry: CacheEntry<T> = {
    data,
    timestamp: now,
    expiresAt: now + ttlMs,
    priority,
  }

  cache.manifest.entries.set(key, entry as CacheEntry<unknown>)
  cache.manifest.totalSize += entrySize
}

/**
 * Retrieve a cache entry if it exists and is not expired.
 */
export function getCacheEntry<T>(cache: CacheInstance, key: string): T | null {
  const entry = cache.manifest.entries.get(key)
  if (!entry) {
    cache.misses++
    return null
  }

  if (Date.now() > entry.expiresAt) {
    // Expired — remove it
    cache.manifest.totalSize -= calculateEntrySize(entry.data)
    cache.manifest.entries.delete(key)
    cache.misses++
    return null
  }

  cache.hits++
  return entry.data as T
}

/**
 * Retrieve a raw cache entry (including metadata) without affecting hit/miss stats.
 */
export function getRawCacheEntry<T>(cache: CacheInstance, key: string): CacheEntry<T> | null {
  const entry = cache.manifest.entries.get(key)
  if (!entry) return null
  return entry as CacheEntry<T>
}

/**
 * Remove a specific entry from the cache.
 */
export function invalidateEntry(cache: CacheInstance, key: string): void {
  const entry = cache.manifest.entries.get(key)
  if (entry) {
    cache.manifest.totalSize -= calculateEntrySize(entry.data)
    cache.manifest.entries.delete(key)
  }
}

/**
 * Remove all expired entries from the cache.
 */
export function cleanupExpired(cache: CacheInstance): number {
  const now = Date.now()
  let removed = 0

  for (const [key, entry] of cache.manifest.entries) {
    if (now > entry.expiresAt) {
      cache.manifest.totalSize -= calculateEntrySize(entry.data)
      cache.manifest.entries.delete(key)
      removed++
    }
  }

  cache.manifest.lastCleanup = now
  return removed
}

/**
 * LRU eviction starting from lowest priority.
 * Removes entries until `bytesNeeded` is freed.
 */
export function evictByPriority(cache: CacheInstance, bytesNeeded: number): void {
  const priorityOrder: CacheEntry<unknown>['priority'][] = ['low', 'normal', 'high', 'critical']
  let freed = 0

  for (const prio of priorityOrder) {
    if (freed >= bytesNeeded) break

    // Collect entries at this priority, sorted by oldest timestamp (LRU)
    const entriesAtPriority: [string, CacheEntry<unknown>][] = []
    for (const [key, entry] of cache.manifest.entries) {
      if (entry.priority === prio) {
        entriesAtPriority.push([key, entry])
      }
    }
    entriesAtPriority.sort((a, b) => a[1].timestamp - b[1].timestamp)

    for (const [key, entry] of entriesAtPriority) {
      if (freed >= bytesNeeded) break
      const size = calculateEntrySize(entry.data)
      cache.manifest.entries.delete(key)
      cache.manifest.totalSize -= size
      freed += size
    }
  }
}

/**
 * Get cache statistics.
 */
export function getCacheStats(cache: CacheInstance): CacheStats {
  const totalRequests = cache.hits + cache.misses
  let oldestEntry: number | null = null

  for (const entry of cache.manifest.entries.values()) {
    if (oldestEntry === null || entry.timestamp < oldestEntry) {
      oldestEntry = entry.timestamp
    }
  }

  return {
    hitRate: totalRequests === 0 ? 0 : cache.hits / totalRequests,
    totalEntries: cache.manifest.entries.size,
    usedBytes: cache.manifest.totalSize,
    oldestEntry,
  }
}

/**
 * Serialize cache to a JSON string for localStorage persistence.
 */
export function serializeCache(cache: CacheInstance): string {
  const entries: [string, CacheEntry<unknown>][] = Array.from(cache.manifest.entries.entries())
  return JSON.stringify({
    entries,
    totalSize: cache.manifest.totalSize,
    lastCleanup: cache.manifest.lastCleanup,
    maxSizeBytes: cache.maxSizeBytes,
    hits: cache.hits,
    misses: cache.misses,
  })
}

/**
 * Restore a cache from a JSON string.
 */
export function deserializeCache(json: string): CacheInstance {
  try {
    const parsed = JSON.parse(json)
    const entries = new Map<string, CacheEntry<unknown>>(parsed.entries)
    return {
      manifest: {
        entries,
        totalSize: parsed.totalSize ?? 0,
        lastCleanup: parsed.lastCleanup ?? Date.now(),
      },
      maxSizeBytes: parsed.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES,
      hits: parsed.hits ?? 0,
      misses: parsed.misses ?? 0,
    }
  } catch {
    return createCache()
  }
}

/**
 * Persist cache to localStorage.
 */
export function persistCache(cache: CacheInstance): void {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, serializeCache(cache))
  } catch {
    // Storage full — clean up expired and retry
    cleanupExpired(cache)
    try {
      localStorage.setItem(CACHE_STORAGE_KEY, serializeCache(cache))
    } catch {
      // Still full, nothing we can do
    }
  }
}

/**
 * Load cache from localStorage.
 */
export function loadCache(): CacheInstance {
  try {
    const json = localStorage.getItem(CACHE_STORAGE_KEY)
    if (!json) return createCache()
    return deserializeCache(json)
  } catch {
    return createCache()
  }
}

export type { CacheInstance }
