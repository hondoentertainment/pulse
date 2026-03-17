import { describe, it, expect, beforeEach } from 'vitest'
import {
  createCache,
  setCacheEntry,
  getCacheEntry,
  invalidateEntry,
  cleanupExpired,
  evictByPriority,
  getCacheStats,
  serializeCache,
  deserializeCache,
  calculateEntrySize,
} from '../offline-cache'
import type { CacheInstance } from '../offline-cache'

let cache: CacheInstance

beforeEach(() => {
  cache = createCache()
})

describe('createCache', () => {
  it('initializes with empty state', () => {
    expect(cache.manifest.entries.size).toBe(0)
    expect(cache.manifest.totalSize).toBe(0)
    expect(cache.maxSizeBytes).toBe(10 * 1024 * 1024)
  })

  it('accepts a custom size limit', () => {
    const small = createCache(1024)
    expect(small.maxSizeBytes).toBe(1024)
  })
})

describe('setCacheEntry / getCacheEntry', () => {
  it('stores and retrieves data', () => {
    setCacheEntry(cache, 'key1', { name: 'test' }, 60_000)
    const result = getCacheEntry<{ name: string }>(cache, 'key1')
    expect(result).toEqual({ name: 'test' })
  })

  it('returns null for missing keys', () => {
    expect(getCacheEntry(cache, 'nonexistent')).toBeNull()
  })

  it('returns null for expired entries', () => {
    setCacheEntry(cache, 'key1', 'data', 1) // 1ms TTL
    // Wait for expiry
    const start = Date.now()
    while (Date.now() - start < 5) { /* spin */ }
    expect(getCacheEntry(cache, 'key1')).toBeNull()
  })

  it('overwrites existing entries', () => {
    setCacheEntry(cache, 'key1', 'first', 60_000)
    setCacheEntry(cache, 'key1', 'second', 60_000)
    expect(getCacheEntry(cache, 'key1')).toBe('second')
    expect(cache.manifest.entries.size).toBe(1)
  })

  it('stores entries with specified priority', () => {
    setCacheEntry(cache, 'key1', 'data', 60_000, 'critical')
    const entry = cache.manifest.entries.get('key1')
    expect(entry?.priority).toBe('critical')
  })

  it('defaults to normal priority', () => {
    setCacheEntry(cache, 'key1', 'data', 60_000)
    const entry = cache.manifest.entries.get('key1')
    expect(entry?.priority).toBe('normal')
  })
})

describe('invalidateEntry', () => {
  it('removes a specific entry', () => {
    setCacheEntry(cache, 'key1', 'data1', 60_000)
    setCacheEntry(cache, 'key2', 'data2', 60_000)
    invalidateEntry(cache, 'key1')
    expect(getCacheEntry(cache, 'key1')).toBeNull()
    expect(getCacheEntry(cache, 'key2')).toBe('data2')
  })

  it('does nothing for nonexistent keys', () => {
    invalidateEntry(cache, 'nonexistent')
    expect(cache.manifest.entries.size).toBe(0)
  })

  it('decrements totalSize', () => {
    setCacheEntry(cache, 'key1', 'data', 60_000)
    const sizeBefore = cache.manifest.totalSize
    invalidateEntry(cache, 'key1')
    expect(cache.manifest.totalSize).toBeLessThan(sizeBefore)
    expect(cache.manifest.totalSize).toBe(0)
  })
})

describe('cleanupExpired', () => {
  it('removes all expired entries', () => {
    setCacheEntry(cache, 'exp1', 'data', 1)
    setCacheEntry(cache, 'exp2', 'data', 1)
    setCacheEntry(cache, 'valid', 'data', 60_000)
    const start = Date.now()
    while (Date.now() - start < 5) { /* spin */ }
    const removed = cleanupExpired(cache)
    expect(removed).toBe(2)
    expect(cache.manifest.entries.size).toBe(1)
    expect(getCacheEntry(cache, 'valid')).toBe('data')
  })

  it('returns 0 when nothing is expired', () => {
    setCacheEntry(cache, 'key1', 'data', 60_000)
    expect(cleanupExpired(cache)).toBe(0)
  })

  it('updates lastCleanup timestamp', () => {
    const before = cache.manifest.lastCleanup
    cleanupExpired(cache)
    expect(cache.manifest.lastCleanup).toBeGreaterThanOrEqual(before)
  })
})

describe('evictByPriority', () => {
  it('evicts low priority entries first', () => {
    setCacheEntry(cache, 'low1', 'data', 60_000, 'low')
    setCacheEntry(cache, 'high1', 'data', 60_000, 'high')
    setCacheEntry(cache, 'critical1', 'data', 60_000, 'critical')

    evictByPriority(cache, calculateEntrySize('data'))
    // Low should be evicted first
    expect(cache.manifest.entries.has('low1')).toBe(false)
    expect(cache.manifest.entries.has('high1')).toBe(true)
    expect(cache.manifest.entries.has('critical1')).toBe(true)
  })

  it('evicts oldest entries within same priority (LRU)', () => {
    setCacheEntry(cache, 'old', 'data', 60_000, 'normal')
    // Artificially make 'old' older
    const oldEntry = cache.manifest.entries.get('old')!
    oldEntry.timestamp = Date.now() - 100_000

    setCacheEntry(cache, 'new', 'data', 60_000, 'normal')

    evictByPriority(cache, calculateEntrySize('data'))
    expect(cache.manifest.entries.has('old')).toBe(false)
    expect(cache.manifest.entries.has('new')).toBe(true)
  })
})

describe('size limit enforcement', () => {
  it('evicts when adding entry would exceed max size', () => {
    const tinyCache = createCache(100)
    setCacheEntry(tinyCache, 'key1', 'a'.repeat(40), 60_000, 'low')
    setCacheEntry(tinyCache, 'key2', 'b'.repeat(40), 60_000, 'high')
    // This should trigger eviction of key1 (lower priority)
    setCacheEntry(tinyCache, 'key3', 'c'.repeat(40), 60_000, 'high')
    expect(tinyCache.manifest.entries.has('key1')).toBe(false)
  })

  it('does not store entries larger than max size', () => {
    const tinyCache = createCache(10)
    setCacheEntry(tinyCache, 'huge', 'x'.repeat(100), 60_000)
    expect(tinyCache.manifest.entries.size).toBe(0)
  })
})

describe('getCacheStats', () => {
  it('returns correct stats for empty cache', () => {
    const stats = getCacheStats(cache)
    expect(stats.totalEntries).toBe(0)
    expect(stats.usedBytes).toBe(0)
    expect(stats.hitRate).toBe(0)
    expect(stats.oldestEntry).toBeNull()
  })

  it('tracks hit rate correctly', () => {
    setCacheEntry(cache, 'key1', 'data', 60_000)
    getCacheEntry(cache, 'key1') // hit
    getCacheEntry(cache, 'key1') // hit
    getCacheEntry(cache, 'missing') // miss
    const stats = getCacheStats(cache)
    expect(stats.hitRate).toBeCloseTo(2 / 3)
  })

  it('reports correct entry count and oldest', () => {
    setCacheEntry(cache, 'old', 'data', 60_000)
    const oldEntry = cache.manifest.entries.get('old')!
    oldEntry.timestamp = 1000
    setCacheEntry(cache, 'new', 'data', 60_000)

    const stats = getCacheStats(cache)
    expect(stats.totalEntries).toBe(2)
    expect(stats.oldestEntry).toBe(1000)
  })
})

describe('calculateEntrySize', () => {
  it('estimates size of string data', () => {
    const size = calculateEntrySize('hello')
    expect(size).toBeGreaterThan(0)
    expect(size).toBe(new TextEncoder().encode(JSON.stringify('hello')).length)
  })

  it('estimates size of object data', () => {
    const obj = { name: 'test', value: 42 }
    const size = calculateEntrySize(obj)
    expect(size).toBe(new TextEncoder().encode(JSON.stringify(obj)).length)
  })

  it('returns 0 for unserializable data', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(calculateEntrySize(circular)).toBe(0)
  })
})

describe('serialization / deserialization', () => {
  it('roundtrips correctly', () => {
    setCacheEntry(cache, 'key1', { name: 'venue1' }, 60_000, 'high')
    setCacheEntry(cache, 'key2', [1, 2, 3], 60_000, 'low')

    const json = serializeCache(cache)
    const restored = deserializeCache(json)

    expect(restored.manifest.entries.size).toBe(2)
    expect(getCacheEntry<{ name: string }>(restored, 'key1')).toEqual({ name: 'venue1' })
    expect(getCacheEntry<number[]>(restored, 'key2')).toEqual([1, 2, 3])
    expect(restored.maxSizeBytes).toBe(cache.maxSizeBytes)
  })

  it('preserves priority and timestamps', () => {
    setCacheEntry(cache, 'key1', 'data', 60_000, 'critical')
    const json = serializeCache(cache)
    const restored = deserializeCache(json)
    const entry = restored.manifest.entries.get('key1')
    expect(entry?.priority).toBe('critical')
    expect(entry?.timestamp).toBeDefined()
  })

  it('returns a fresh cache on invalid JSON', () => {
    const restored = deserializeCache('not-valid-json')
    expect(restored.manifest.entries.size).toBe(0)
  })
})

describe('edge cases', () => {
  it('handles empty cache operations gracefully', () => {
    expect(getCacheEntry(cache, 'anything')).toBeNull()
    invalidateEntry(cache, 'anything')
    expect(cleanupExpired(cache)).toBe(0)
    evictByPriority(cache, 1000)
    expect(cache.manifest.entries.size).toBe(0)
  })

  it('handles single entry cache', () => {
    const tinyCache = createCache(200)
    setCacheEntry(tinyCache, 'only', 'val', 60_000)
    expect(getCacheEntry(tinyCache, 'only')).toBe('val')
    invalidateEntry(tinyCache, 'only')
    expect(tinyCache.manifest.entries.size).toBe(0)
    expect(tinyCache.manifest.totalSize).toBe(0)
  })
})
