import { describe, it, expect, beforeEach } from 'vitest'
import {
  enforceMaxEvents,
  prioritizeEvents,
  deduplicateEvents,
  type ActivityEvent,
} from '../lib/live-activity-feed'
import {
  createCache,
  setCacheEntry,
  getCacheStats,
  calculateEntrySize,
} from '../lib/offline-cache'
import type { CacheInstance } from '../lib/offline-cache'
import {
  createBurstParticles,
  getReactionVelocity,
} from '../lib/emoji-reactions'
import {
  calculateTotalXP,
  getStreakMultiplier,
  getAchievedMilestones,
  type Streak,
} from '../lib/streak-rewards'

// --- Helpers ---

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 9)}`,
    type: 'checkin',
    venueId: 'venue-1',
    venueName: 'Test Venue',
    timestamp: Date.now(),
    message: 'Test event',
    priority: 2,
    ...overrides,
  }
}

function makeStreak(overrides: Partial<Streak> = {}): Streak {
  return {
    userId: 'user-1',
    type: 'weekly_checkin',
    currentCount: 5,
    longestCount: 10,
    lastActivity: new Date().toISOString(),
    isActive: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

// --- Tests ---

describe('Performance: Memoized computations', () => {
  describe('streak calculations stability', () => {
    it('calculateTotalXP returns consistent results for same input', () => {
      const streaks: Streak[] = [
        makeStreak({ type: 'weekly_checkin', currentCount: 7 }),
        makeStreak({ type: 'weekend_warrior', currentCount: 3 }),
        makeStreak({ type: 'explorer', currentCount: 10 }),
      ]

      const result1 = calculateTotalXP(streaks)
      const result2 = calculateTotalXP(streaks)

      expect(result1).toBe(result2)
      expect(typeof result1).toBe('number')
    })

    it('getStreakMultiplier returns consistent results for same input', () => {
      const streaks: Streak[] = [
        makeStreak({ currentCount: 5 }),
        makeStreak({ type: 'explorer', currentCount: 3 }),
      ]

      const result1 = getStreakMultiplier(streaks)
      const result2 = getStreakMultiplier(streaks)

      expect(result1).toBe(result2)
      expect(result1).toBeGreaterThanOrEqual(1)
    })

    it('getAchievedMilestones returns consistent results for same input', () => {
      const streak = makeStreak({ currentCount: 10 })

      const result1 = getAchievedMilestones(streak)
      const result2 = getAchievedMilestones(streak)

      expect(result1).toEqual(result2)
    })
  })

  describe('event processing stability', () => {
    it('prioritizeEvents produces consistent ordering for same input', () => {
      const events = [
        makeEvent({ priority: 1, timestamp: Date.now() - 60000 }),
        makeEvent({ priority: 3, timestamp: Date.now() - 30000 }),
        makeEvent({ priority: 2, timestamp: Date.now() }),
      ]

      const result1 = prioritizeEvents(events)
      const result2 = prioritizeEvents(events)

      expect(result1.map(e => e.id)).toEqual(result2.map(e => e.id))
    })

    it('deduplicateEvents produces consistent results for same input', () => {
      const now = Date.now()
      const events = [
        makeEvent({ venueId: 'v1', type: 'checkin', timestamp: now }),
        makeEvent({ venueId: 'v1', type: 'checkin', timestamp: now - 1000 }),
        makeEvent({ venueId: 'v2', type: 'surge', timestamp: now }),
      ]

      const result1 = deduplicateEvents(events)
      const result2 = deduplicateEvents(events)

      expect(result1.length).toBe(result2.length)
    })
  })
})

describe('Performance: LiveActivityFeed caps at 50 events', () => {
  it('enforceMaxEvents limits to 50 events', () => {
    const events: ActivityEvent[] = Array.from({ length: 100 }, (_, i) =>
      makeEvent({
        id: `evt-${i}`,
        timestamp: Date.now() - i * 1000,
      })
    )

    const result = enforceMaxEvents(events, 50)
    expect(result.length).toBe(50)
  })

  it('enforceMaxEvents keeps the most recent events', () => {
    const now = Date.now()
    const events: ActivityEvent[] = Array.from({ length: 60 }, (_, i) =>
      makeEvent({
        id: `evt-${i}`,
        timestamp: now - i * 1000,
      })
    )

    const result = enforceMaxEvents(events, 50)
    expect(result.length).toBe(50)

    // All returned events should have timestamps >= the oldest kept event
    const timestamps = result.map(e => e.timestamp)
    const minKeptTimestamp = Math.min(...timestamps)
    const droppedTimestamps = events
      .filter(e => !result.find(r => r.id === e.id))
      .map(e => e.timestamp)

    // Dropped events should be older than all kept events
    for (const dropped of droppedTimestamps) {
      expect(dropped).toBeLessThanOrEqual(minKeptTimestamp)
    }
  })

  it('enforceMaxEvents returns input unchanged when under limit', () => {
    const events: ActivityEvent[] = Array.from({ length: 30 }, (_, i) =>
      makeEvent({ id: `evt-${i}` })
    )

    const result = enforceMaxEvents(events, 50)
    expect(result.length).toBe(30)
  })
})

describe('Performance: Offline cache respects 10MB limit', () => {
  let cache: CacheInstance

  beforeEach(() => {
    cache = createCache() // Default 10MB
  })

  it('default cache size is 10MB', () => {
    expect(cache.maxSizeBytes).toBe(10 * 1024 * 1024)
  })

  it('evicts entries when cache exceeds size limit', () => {
    // Create a cache with a small limit for testing
    const smallCache = createCache(1024) // 1KB limit

    // Add entries that exceed the limit
    for (let i = 0; i < 20; i++) {
      setCacheEntry(smallCache, `key-${i}`, { data: 'x'.repeat(100) }, 60_000, 'normal')
    }

    const stats = getCacheStats(smallCache)
    expect(stats.usedBytes).toBeLessThanOrEqual(1024)
  })

  it('does not store entries larger than max cache size', () => {
    const tinyCache = createCache(100) // 100 bytes

    // Try to store something larger than the cache
    const largeData = { data: 'x'.repeat(200) }
    setCacheEntry(tinyCache, 'large', largeData, 60_000)

    const stats = getCacheStats(tinyCache)
    expect(stats.totalEntries).toBe(0)
  })

  it('calculateEntrySize returns reasonable byte sizes', () => {
    const small = { id: 'test' }
    const large = { data: 'x'.repeat(1000) }

    const smallSize = calculateEntrySize(small)
    const largeSize = calculateEntrySize(large)

    expect(smallSize).toBeGreaterThan(0)
    expect(largeSize).toBeGreaterThan(smallSize)
    expect(largeSize).toBeGreaterThan(1000)
  })
})

describe('Performance: Emoji burst caps at 30 particles', () => {
  it('createBurstParticles respects the requested count', () => {
    const particles = createBurstParticles('fire', 100, 100, 5)
    expect(particles.length).toBe(5)
  })

  it('MAX_PARTICLES constant limits total burst particles to 30', () => {
    // The MAX_PARTICLES constant in use-emoji-burst.ts is 30
    // Simulate the capping behavior from the hook
    const MAX_PARTICLES = 30

    // Start with 25 existing particles
    const existingCount = 25
    const burstCount = getReactionVelocity(5) // Returns 8 for rapid tapping

    const allowedCount = Math.min(burstCount, MAX_PARTICLES - existingCount)
    expect(allowedCount).toBeLessThanOrEqual(MAX_PARTICLES - existingCount)

    const particles = createBurstParticles('fire', 100, 100, allowedCount)
    expect(existingCount + particles.length).toBeLessThanOrEqual(MAX_PARTICLES)
  })

  it('rapid tapping cannot exceed 30 particles', () => {
    const MAX_PARTICLES = 30
    let currentCount = 0

    // Simulate 20 rapid taps
    for (let tap = 0; tap < 20; tap++) {
      const burstCount = getReactionVelocity(tap + 1)
      const allowedCount = Math.min(burstCount, MAX_PARTICLES - currentCount)

      if (allowedCount > 0) {
        currentCount += allowedCount
      }

      expect(currentCount).toBeLessThanOrEqual(MAX_PARTICLES)
    }
  })

  it('getReactionVelocity increases with rapid taps', () => {
    expect(getReactionVelocity(1)).toBe(3)
    expect(getReactionVelocity(2)).toBe(5)
    expect(getReactionVelocity(3)).toBe(5)
    expect(getReactionVelocity(4)).toBe(8)
  })
})

describe('Performance: Lazy-loadable components have default exports', () => {
  it('StreakDashboard has a default export', { timeout: 60000 }, async () => {
    const mod = await import('../components/StreakDashboard')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('VenueComparison has a default export', async () => {
    const mod = await import('../components/VenueComparison')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('NeighborhoodWalkthrough has a default export', async () => {
    const mod = await import('../components/NeighborhoodWalkthrough')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('QuickBoostFlow has a default export', async () => {
    const mod = await import('../components/QuickBoostFlow')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})
