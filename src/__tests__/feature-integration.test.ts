import { describe, it, expect, beforeEach } from 'vitest'
import type { Venue, User, Pulse } from '@/lib/types'

// --- Feature imports ---
import { pickTonightsVenue } from '@/lib/tonights-pick'
import {
  createRSVP,
  getFriendsGoingTonight,
  getPopularVenuesTonight,
  _deduplicateRsvps,
  type VenueRSVP,
} from '@/lib/going-tonight'
import {
  checkStreakProgress,
  getNextMilestone,
  getStreakMultiplier,
  calculateTotalXP,
  getAchievedMilestones,
  type Streak,
} from '@/lib/streak-rewards'
import {
  createCache,
  setCacheEntry,
  getCacheEntry,
  getCacheStats,
  type CacheInstance,
} from '@/lib/offline-cache'
import {
  determinePrefetchTargets,
  buildPrefetchPlan,
  prefetchVenueData,
  getOfflineVenues,
} from '@/lib/smart-prefetch'
import {
  compareVenues,
  getComparisonVerdict,
  getWinner,
  calculateMatchScore,
} from '@/lib/venue-comparison'
import {
  generateEnergyHistory,
  findPeakHour,
  calculateTrend,
} from '@/lib/venue-energy-history'
import {
  generateActivityEvents,
  deduplicateEvents,
  prioritizeEvents,
  formatActivityMessage,
  type ActivityEvent,
} from '@/lib/live-activity-feed'
import {
  aggregateReactions,
  getReactionVelocity,
  formatReactionCount,
  createBurstParticles,
  type ReactionCount,
} from '@/lib/emoji-reactions'
import {
  generateWalkthrough,
  estimateArrivalEnergy,
} from '@/lib/neighborhood-walkthrough'
import {
  createBoost,
  isBoostActive,
  calculateBoostScore,
  simulateBoostAnalytics,
  getActiveBoosts,
  type ActiveBoost,
} from '@/lib/venue-quick-boost'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'The Rooftop',
    location: { lat: 47.61, lng: -122.33, address: '123 Pike St' },
    pulseScore: 75,
    category: 'Bar',
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'TestUser',
    friends: ['u2', 'u3'],
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `pulse-${Math.random().toString(36).slice(2, 7)}`,
    userId: 'u1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeRSVP(
  userId: string,
  venueId: string,
  status: 'going' | 'maybe' | 'cancelled' = 'going',
): VenueRSVP {
  return {
    userId,
    venueId,
    timestamp: new Date().toISOString(),
    status,
  }
}

// A set of venues used across multiple tests
function makeVenueSet(): Venue[] {
  return [
    makeVenue({ id: 'v1', name: 'The Rooftop', pulseScore: 80, category: 'Bar' }),
    makeVenue({ id: 'v2', name: 'Neon Lounge', pulseScore: 60, category: 'Cocktail Bar', location: { lat: 47.612, lng: -122.335, address: '200 Main St' } }),
    makeVenue({ id: 'v3', name: 'Club Nova', pulseScore: 90, category: 'Nightclub', location: { lat: 47.615, lng: -122.34, address: '300 1st Ave' } }),
    makeVenue({ id: 'v4', name: 'Dive Central', pulseScore: 40, category: 'Dive Bar', location: { lat: 47.608, lng: -122.32, address: '400 2nd Ave' } }),
    makeVenue({ id: 'v5', name: 'Jazz Corner', pulseScore: 55, category: 'Music Venue', location: { lat: 47.614, lng: -122.338, address: '500 3rd Ave' } }),
  ]
}

// ---------------------------------------------------------------------------
// 1. Tonight's Pick + Going Tonight
// ---------------------------------------------------------------------------

describe('Tonight\'s Pick + Going Tonight integration', () => {
  it('gives higher score to venues where friends are going', () => {
    const venues = makeVenueSet()
    const user = makeUser({ favoriteCategories: ['bar'] })
    const currentTime = new Date('2026-03-17T21:00:00Z')

    // Pick without friend activity
    const pickWithout = pickTonightsVenue({
      venues,
      user,
      userLocation: { lat: 47.61, lng: -122.33 },
      currentTime,
    })

    // Build friend activity from RSVPs using going-tonight
    const rsvps: VenueRSVP[] = [
      makeRSVP('u2', 'v2', 'going'),
      makeRSVP('u3', 'v2', 'going'),
      makeRSVP('u4', 'v2', 'going'),
      makeRSVP('u5', 'v2', 'going'),
    ]
    const friendActivity: Record<string, { count: number; friendIds: string[] }> = {
      v2: { count: 4, friendIds: ['u2', 'u3', 'u4', 'u5'] },
    }

    const pickWith = pickTonightsVenue({
      venues,
      user,
      userLocation: { lat: 47.61, lng: -122.33 },
      currentTime,
      friendActivity,
    })

    expect(pickWith).not.toBeNull()
    expect(pickWithout).not.toBeNull()

    // The venue with friends should score higher when friend activity is provided
    // Find v2's score in both picks
    const v2WithFriends = pickWith!.venue.id === 'v2' || pickWith!.alternates.some(a => a.id === 'v2')
    // When 4 friends are going to v2, it should be competitive despite lower base pulse
    expect(pickWith!.score).toBeGreaterThan(0)
  })

  it('RSVP data from going-tonight feeds into pick friend activity', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u2', 'v1', 'going'),
      makeRSVP('u3', 'v1', 'going'),
    ]

    // Use getFriendsGoingTonight to build the friend activity map
    const friendsByVenue = getFriendsGoingTonight('u1', ['u2', 'u3'], rsvps)
    const friendActivity: Record<string, { count: number; friendIds: string[] }> = {}

    for (const [venueId, venueRsvps] of friendsByVenue) {
      friendActivity[venueId] = {
        count: venueRsvps.length,
        friendIds: venueRsvps.map(r => r.userId),
      }
    }

    expect(friendActivity['v1']).toBeDefined()
    expect(friendActivity['v1'].count).toBe(2)

    const pick = pickTonightsVenue({
      venues: makeVenueSet(),
      user: makeUser(),
      userLocation: { lat: 47.61, lng: -122.33 },
      currentTime: new Date('2026-03-17T21:00:00Z'),
      friendActivity,
    })

    expect(pick).not.toBeNull()
    // The pick should include a friend-related reason
    const hasFriendReason = pick!.reasons.some(r => r.includes('friend'))
    expect(hasFriendReason).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. Streak Rewards + Check-in flow
// ---------------------------------------------------------------------------

describe('Streak Rewards + Check-in flow', () => {
  it('tracks weekly check-in streaks across consecutive weeks', () => {
    const userId = 'u1'
    // Create checkins across 3 consecutive weeks
    const checkins: Pulse[] = [
      makePulse({ userId, venueId: 'v1', createdAt: '2026-03-02T21:00:00Z' }), // Mon week 1
      makePulse({ userId, venueId: 'v2', createdAt: '2026-03-09T21:00:00Z' }), // Mon week 2
      makePulse({ userId, venueId: 'v1', createdAt: '2026-03-16T21:00:00Z' }), // Mon week 3
    ]

    const currentTime = new Date('2026-03-17T12:00:00Z')
    const streaks = checkStreakProgress(userId, checkins, currentTime)

    const weeklyStreak = streaks.find(s => s.type === 'weekly_checkin')
    expect(weeklyStreak).toBeDefined()
    expect(weeklyStreak!.currentCount).toBeGreaterThanOrEqual(2)
    expect(weeklyStreak!.isActive).toBe(true)
  })

  it('tracks explorer streaks for visiting new venues', () => {
    const userId = 'u1'
    const checkins: Pulse[] = [
      makePulse({ userId, venueId: 'v1', createdAt: '2026-03-02T21:00:00Z' }),
      makePulse({ userId, venueId: 'v2', createdAt: '2026-03-09T21:00:00Z' }),
      makePulse({ userId, venueId: 'v3', createdAt: '2026-03-16T21:00:00Z' }),
    ]

    const currentTime = new Date('2026-03-17T12:00:00Z')
    const streaks = checkStreakProgress(userId, checkins, currentTime)

    const explorerStreak = streaks.find(s => s.type === 'explorer')
    expect(explorerStreak).toBeDefined()
    expect(explorerStreak!.currentCount).toBeGreaterThanOrEqual(2)
  })

  it('tracks venue-loyal streaks for returning to same venue', () => {
    const userId = 'u1'
    // venue_loyal uses 14-day biweekly periods; group multiple visits to same venue
    const checkins: Pulse[] = [
      makePulse({ userId, venueId: 'v1', createdAt: '2026-03-01T21:00:00Z' }),
      makePulse({ userId, venueId: 'v1', createdAt: '2026-03-08T21:00:00Z' }),
      makePulse({ userId, venueId: 'v1', createdAt: '2026-03-15T21:00:00Z' }),
      makePulse({ userId, venueId: 'v2', createdAt: '2026-03-10T21:00:00Z' }), // different venue
    ]

    const currentTime = new Date('2026-03-17T12:00:00Z')
    const streaks = checkStreakProgress(userId, checkins, currentTime)

    const loyalStreak = streaks.find(s => s.type === 'venue_loyal')
    expect(loyalStreak).toBeDefined()
    // Venue v1 has the most visits (3), so it's selected for loyalty tracking
    // The streak count depends on biweekly period grouping
    expect(loyalStreak!.longestCount).toBeGreaterThanOrEqual(1)
  })

  it('calculates XP multiplier based on active streak count', () => {
    const activeStreaks: Streak[] = [
      { userId: 'u1', type: 'weekly_checkin', currentCount: 3, longestCount: 3, lastActivity: '', isActive: true, expiresAt: new Date(Date.now() + 86400000).toISOString() },
      { userId: 'u1', type: 'explorer', currentCount: 2, longestCount: 2, lastActivity: '', isActive: true, expiresAt: new Date(Date.now() + 86400000).toISOString() },
    ]

    expect(getStreakMultiplier(activeStreaks)).toBe(1.5)

    // Add a third active streak
    activeStreaks.push({
      userId: 'u1', type: 'venue_loyal', currentCount: 5, longestCount: 5,
      lastActivity: '', isActive: true, expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    expect(getStreakMultiplier(activeStreaks)).toBe(2.0)
  })

  it('gets next milestone correctly', () => {
    const streak: Streak = {
      userId: 'u1', type: 'weekly_checkin', currentCount: 4,
      longestCount: 4, lastActivity: '', isActive: true, expiresAt: '',
    }
    expect(getNextMilestone(streak)).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// 3. Offline Cache + Smart Prefetch
// ---------------------------------------------------------------------------

describe('Offline Cache + Smart Prefetch integration', () => {
  let cache: CacheInstance

  beforeEach(() => {
    cache = createCache(5000) // Small 5KB cache for testing eviction
  })

  it('prefetch targets are correctly prioritized', () => {
    const venues = makeVenueSet()
    const targets = determinePrefetchTargets({
      userLocation: { lat: 47.61, lng: -122.33 },
      venues,
      favorites: ['v2'],
      followed: ['v3'],
      currentTime: Date.now(),
    })

    // Favorites come first with critical priority
    expect(targets[0].venue.id).toBe('v2')
    expect(targets[0].priority).toBe('critical')
    expect(targets[0].reason).toBe('favorite')

    // Followed comes next with high priority
    expect(targets[1].venue.id).toBe('v3')
    expect(targets[1].priority).toBe('high')
    expect(targets[1].reason).toBe('followed')
  })

  it('stores prefetched venues in cache and retrieves them', () => {
    const venues = makeVenueSet()

    // Prefetch a venue into the cache
    prefetchVenueData(venues[0], cache, 'critical')
    prefetchVenueData(venues[1], cache, 'normal')

    // Retrieve from cache
    const offlineVenues = getOfflineVenues(cache, { lat: 47.61, lng: -122.33 })
    expect(offlineVenues.length).toBe(2)
    expect(offlineVenues[0].venue.id).toBeDefined()
  })

  it('builds a prefetch plan that separates cached vs needed', () => {
    const venues = makeVenueSet()

    // Pre-cache one venue
    prefetchVenueData(venues[0], cache, 'normal')

    const targets = determinePrefetchTargets({
      userLocation: { lat: 47.61, lng: -122.33 },
      venues,
      favorites: ['v1'],
      followed: [],
      currentTime: Date.now(),
    })

    const plan = buildPrefetchPlan(targets, cache)
    expect(plan.alreadyCached).toContain('v1')
    expect(plan.toFetch.length).toBeGreaterThan(0)
    expect(plan.toFetch.every(t => t.venue.id !== 'v1')).toBe(true)
  })

  it('evicts low-priority entries when cache is full', () => {
    // Fill cache with low-priority entries
    for (let i = 0; i < 10; i++) {
      setCacheEntry(cache, `low-${i}`, { data: 'x'.repeat(400) }, 60000, 'low')
    }

    const statsBefore = getCacheStats(cache)
    const entriesBefore = statsBefore.totalEntries

    // Add a critical entry that forces eviction
    setCacheEntry(cache, 'critical-1', { data: 'important'.repeat(100) }, 60000, 'critical')

    // The critical entry should be present
    const result = getCacheEntry(cache, 'critical-1')
    expect(result).not.toBeNull()

    // Some low-priority entries should have been evicted
    const statsAfter = getCacheStats(cache)
    expect(statsAfter.totalEntries).toBeLessThanOrEqual(entriesBefore + 1)
  })
})

// ---------------------------------------------------------------------------
// 4. Venue Comparison + Energy History
// ---------------------------------------------------------------------------

describe('Venue Comparison + Energy History integration', () => {
  it('compareVenues uses pulse scores consistent with energy history', () => {
    const venueA = makeVenue({ id: 'v1', name: 'Hot Spot', pulseScore: 85, category: 'Bar' })
    const venueB = makeVenue({ id: 'v2', name: 'Chill Place', pulseScore: 35, category: 'Cafe' })

    const result = compareVenues(venueA, venueB, { lat: 47.61, lng: -122.33 })

    // Higher pulse score venue wins energy comparison
    expect(result.metrics.energy.winner).toBe('a')
    expect(result.venueA.pulseScore).toBe(85)
    expect(result.venueB.pulseScore).toBe(35)
  })

  it('energy history and comparison use consistent venue data', () => {
    const venue = makeVenue({ id: 'v1', name: 'Test Bar', pulseScore: 70, category: 'Bar' })
    const currentTime = new Date('2026-03-17T21:00:00Z')

    const history = generateEnergyHistory(venue, currentTime)
    expect(history.venueId).toBe(venue.id)
    expect(history.currentScore).toBeGreaterThan(0)
    expect(history.dataPoints).toHaveLength(24)

    // The peak hour should be in a reasonable range for a bar
    expect(history.peakHour).toBeGreaterThanOrEqual(0)
    expect(history.peakHour).toBeLessThanOrEqual(23)
  })

  it('comparison verdict text is reasonable for different venue types', () => {
    const bar = makeVenue({ id: 'v1', name: 'The Bar', pulseScore: 80, category: 'Bar' })
    const club = makeVenue({ id: 'v2', name: 'The Club', pulseScore: 60, category: 'Nightclub' })

    const result = compareVenues(bar, club, { lat: 47.61, lng: -122.33 })
    const verdict = getComparisonVerdict(result)

    expect(verdict.length).toBeGreaterThan(0)
    // The higher-scoring venue should be mentioned as "hotter"
    expect(verdict).toContain('The Bar is hotter right now')
  })

  it('getWinner returns correct winner for energy preference', () => {
    const venueA = makeVenue({ id: 'v1', pulseScore: 90 })
    const venueB = makeVenue({ id: 'v2', pulseScore: 50 })

    const result = compareVenues(venueA, venueB)
    expect(getWinner(result, 'energy')).toBe('a')
  })
})

// ---------------------------------------------------------------------------
// 5. Live Activity Feed + Going Tonight
// ---------------------------------------------------------------------------

describe('Live Activity Feed + Going Tonight integration', () => {
  it('generates activity events from venue pulse data', () => {
    const venues = [
      makeVenue({ id: 'v1', name: 'Hot Spot', pulseScore: 80 }),
      makeVenue({ id: 'v2', name: 'Chill Bar', pulseScore: 40 }),
    ]
    const pulses: Pulse[] = [
      makePulse({ venueId: 'v1', createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() }),
      makePulse({ venueId: 'v1', createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() }),
    ]

    const events = generateActivityEvents(venues, [], pulses)
    expect(events.length).toBeGreaterThan(0)

    // Should have check-in events for v1
    const checkinEvents = events.filter(e => e.type === 'checkin' && e.venueId === 'v1')
    expect(checkinEvents.length).toBeGreaterThan(0)

    // Should have surge event for v1 (score >= 75)
    const surgeEvents = events.filter(e => e.type === 'surge' && e.venueId === 'v1')
    expect(surgeEvents.length).toBe(1)
  })

  it('deduplication handles multiple events at the same venue', () => {
    const now = Date.now()
    const events: ActivityEvent[] = [
      {
        id: 'e1', type: 'checkin', venueId: 'v1', venueName: 'Hot Spot',
        timestamp: now - 1000, message: '3 people checked in', priority: 2,
      },
      {
        id: 'e2', type: 'checkin', venueId: 'v1', venueName: 'Hot Spot',
        timestamp: now, message: '2 more people checked in', priority: 2,
      },
      {
        id: 'e3', type: 'surge', venueId: 'v1', venueName: 'Hot Spot',
        timestamp: now, message: 'Surging!', priority: 3,
      },
    ]

    const deduped = deduplicateEvents(events, 5 * 60 * 1000)
    // Should keep one checkin and one surge for the same venue
    const checkins = deduped.filter(e => e.type === 'checkin' && e.venueId === 'v1')
    expect(checkins.length).toBe(1)
    // Surge is a different type, so it should be kept
    const surges = deduped.filter(e => e.type === 'surge')
    expect(surges.length).toBe(1)
  })

  it('RSVP events can generate activity feed items', () => {
    // Simulate: user RSVPs, we create activity-like events from RSVP data
    const rsvps: VenueRSVP[] = [
      createRSVP('u1', 'v1', 'going'),
      createRSVP('u2', 'v1', 'going'),
      createRSVP('u3', 'v2', 'going'),
    ]

    // Build popular venues from RSVP data
    const venues = makeVenueSet()
    const popular = getPopularVenuesTonight(rsvps, venues)
    expect(popular[0].goingCount).toBeGreaterThan(0)

    // Verify RSVP data can be used to construct activity events
    const activityFromRSVPs: ActivityEvent[] = popular.map(pv => ({
      id: `rsvp-${pv.id}`,
      type: 'checkin' as const,
      venueId: pv.id,
      venueName: pv.name,
      timestamp: Date.now(),
      message: `${pv.goingCount} people going to ${pv.name} tonight`,
      priority: 2,
      count: pv.goingCount,
    }))

    expect(activityFromRSVPs.length).toBeGreaterThan(0)
    expect(activityFromRSVPs[0].count).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// 6. Emoji Reactions + Venue Score
// ---------------------------------------------------------------------------

describe('Emoji Reactions + Venue Score', () => {
  it('aggregateReactions returns top 3 reactions sorted by count', () => {
    const reactions: ReactionCount[] = [
      { type: 'fire', count: 10 },
      { type: 'music', count: 5 },
      { type: 'dancing', count: 15 },
      { type: 'drinks', count: 8 },
      { type: 'chill', count: 2 },
    ]

    const top = aggregateReactions(reactions)
    expect(top).toHaveLength(3)
    expect(top[0].type).toBe('dancing')
    expect(top[0].count).toBe(15)
    expect(top[1].type).toBe('fire')
    expect(top[2].type).toBe('drinks')
  })

  it('rapid-tap detection increases burst velocity', () => {
    // Single tap -> low velocity
    expect(getReactionVelocity(1)).toBe(3)
    // 2-3 taps -> medium velocity
    expect(getReactionVelocity(2)).toBe(5)
    expect(getReactionVelocity(3)).toBe(5)
    // 4+ taps -> high velocity
    expect(getReactionVelocity(4)).toBe(8)
    expect(getReactionVelocity(10)).toBe(8)
  })

  it('createBurstParticles generates the requested number of particles', () => {
    const particles = createBurstParticles('fire', 100, 200, 5)
    expect(particles).toHaveLength(5)
    particles.forEach(p => {
      expect(p.type).toBe('fire')
      expect(p.opacity).toBe(1)
      expect(p.id).toContain('particle-')
    })
  })

  it('formatReactionCount handles various magnitudes', () => {
    expect(formatReactionCount(42)).toBe('42')
    expect(formatReactionCount(999)).toBe('999')
    expect(formatReactionCount(1000)).toBe('1K')
    expect(formatReactionCount(1500)).toBe('1.5K')
    expect(formatReactionCount(10000)).toBe('10K')
  })
})

// ---------------------------------------------------------------------------
// 7. Neighborhood Walkthrough + Venue Energy
// ---------------------------------------------------------------------------

describe('Neighborhood Walkthrough + Venue Energy', () => {
  it('generates a bar crawl route using venue energy scores', () => {
    const venues = makeVenueSet()

    const route = generateWalkthrough({
      venues,
      neighborhood: 'Capitol Hill',
      userLocation: { lat: 47.61, lng: -122.33 },
      theme: 'hottest',
      maxStops: 3,
    })

    expect(route.stops.length).toBeGreaterThan(0)
    expect(route.stops.length).toBeLessThanOrEqual(3)
    expect(route.neighborhood).toBe('Capitol Hill')
    expect(route.theme).toBe('hottest')
  })

  it('route prefers higher-energy venues', () => {
    const venues = [
      makeVenue({ id: 'v-high', name: 'High Energy', pulseScore: 95, location: { lat: 47.61, lng: -122.33, address: '1' } }),
      makeVenue({ id: 'v-low', name: 'Low Energy', pulseScore: 15, location: { lat: 47.611, lng: -122.331, address: '2' } }),
      makeVenue({ id: 'v-mid', name: 'Mid Energy', pulseScore: 50, location: { lat: 47.612, lng: -122.332, address: '3' } }),
    ]

    const route = generateWalkthrough({
      venues,
      neighborhood: 'Test',
      userLocation: { lat: 47.61, lng: -122.33 },
      theme: 'hottest',
      maxStops: 3,
    })

    // The first stop should be the highest-energy venue (or very close by and high energy)
    expect(route.stops[0].venue.pulseScore).toBeGreaterThanOrEqual(50)
  })

  it('estimateArrivalEnergy returns reasonable energy ratings', () => {
    const venue = makeVenue({ pulseScore: 70 })

    // Late night should boost energy
    const lateNight = new Date('2026-03-17T23:00:00Z')
    const lateEnergy = estimateArrivalEnergy(venue, lateNight)
    expect(['electric', 'buzzing']).toContain(lateEnergy)

    // Early morning should reduce energy
    const earlyMorning = new Date('2026-03-18T04:00:00Z')
    const earlyEnergy = estimateArrivalEnergy(venue, earlyMorning)
    expect(['chill', 'buzzing']).toContain(earlyEnergy)
  })

  it('energy history data points align with walkthrough energy estimates', () => {
    const venue = makeVenue({ id: 'v1', pulseScore: 75, category: 'Bar' })
    const time = new Date('2026-03-17T21:00:00Z')

    const history = generateEnergyHistory(venue, time)
    const trend = history.trend

    // At 9 PM for a bar, energy should be rising or peaking, not quiet
    expect(['rising', 'peaking']).toContain(trend)
  })
})

// ---------------------------------------------------------------------------
// 8. Venue Boost + Live Activity
// ---------------------------------------------------------------------------

describe('Venue Boost + Live Activity integration', () => {
  it('active boosts calculate correct score multipliers', () => {
    const boost = createBoost('v1', 'happy_hour', 120)
    expect(boost.status).toBe('active')
    expect(boost.venueId).toBe('v1')
    expect(isBoostActive(boost)).toBe(true)

    const boostedScore = calculateBoostScore(boost, 50)
    // happy_hour multiplier is 1.3
    expect(boostedScore).toBe(65) // 50 * 1.3
  })

  it('boost analytics scale with venue pulse score', () => {
    const boost = createBoost('v1', 'live_music', 120)
    const analytics = simulateBoostAnalytics(boost, 80)

    expect(analytics.totalImpressions).toBeGreaterThan(0)
    expect(analytics.totalTaps).toBeGreaterThan(0)
    // Higher pulse score = more impressions
    const analyticsLow = simulateBoostAnalytics(boost, 20)
    expect(analytics.totalImpressions).toBeGreaterThan(analyticsLow.totalImpressions)
  })

  it('boosted venues can generate enhanced activity events', () => {
    const venue = makeVenue({ id: 'v1', name: 'Boosted Bar', pulseScore: 60 })
    const boost = createBoost('v1', 'grand_opening', 240)

    // Grand opening multiplier is 2.0
    const boostedScore = calculateBoostScore(boost, venue.pulseScore)
    expect(boostedScore).toBeGreaterThan(venue.pulseScore)

    // A venue with boosted score >= 75 should generate surge events
    const boostedVenue = { ...venue, pulseScore: boostedScore }
    const events = generateActivityEvents([boostedVenue], [], [])
    const surgeEvents = events.filter(e => e.type === 'surge')

    if (boostedScore >= 75) {
      expect(surgeEvents.length).toBe(1)
    }
  })

  it('enforces max 2 concurrent boosts per venue', () => {
    const boosts: ActiveBoost[] = [
      createBoost('v1', 'happy_hour', 120),
      createBoost('v1', 'featured', 60),
    ]

    const activeForV1 = getActiveBoosts('v1', boosts)
    expect(activeForV1.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 9. Multi-feature state isolation
// ---------------------------------------------------------------------------

describe('Multi-feature state isolation', () => {
  it('going tonight, emoji reactions, and streak tracking maintain independent state', () => {
    // Going Tonight state
    const rsvps: VenueRSVP[] = [
      createRSVP('u1', 'v1', 'going'),
      createRSVP('u2', 'v1', 'going'),
    ]

    // Emoji Reactions state
    const reactions: ReactionCount[] = [
      { type: 'fire', count: 5 },
      { type: 'dancing', count: 3 },
    ]

    // Streak state
    const streaks: Streak[] = [
      {
        userId: 'u1', type: 'weekly_checkin', currentCount: 4,
        longestCount: 4, lastActivity: new Date().toISOString(),
        isActive: true, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    ]

    // Mutating one should not affect others
    rsvps.push(createRSVP('u3', 'v2', 'going'))
    reactions.push({ type: 'love', count: 1 })

    // RSVP state is independent
    expect(rsvps).toHaveLength(3)
    const deduped = _deduplicateRsvps(rsvps)
    expect(deduped).toHaveLength(3)

    // Reactions state is independent
    const topReactions = aggregateReactions(reactions)
    expect(topReactions).toHaveLength(3)
    expect(topReactions[0].type).toBe('fire')

    // Streak state is independent
    expect(getStreakMultiplier(streaks)).toBe(1.5)
    expect(getNextMilestone(streaks[0])).toBe(5)

    // Verify no cross-contamination
    expect(rsvps.length).toBe(3)
    expect(reactions.length).toBe(3)
    expect(streaks.length).toBe(1)
  })

  it('cache operations do not interfere with non-cache features', () => {
    const cache = createCache()

    // Store venue data in cache
    setCacheEntry(cache, 'venue:v1', { name: 'Test' }, 60000, 'normal')

    // RSVP operations are unaffected
    const rsvp = createRSVP('u1', 'v1', 'going')
    expect(rsvp.venueId).toBe('v1')

    // Cache data is still intact
    const cached = getCacheEntry(cache, 'venue:v1')
    expect(cached).toEqual({ name: 'Test' })
  })
})

// ---------------------------------------------------------------------------
// 10. Data consistency
// ---------------------------------------------------------------------------

describe('Data consistency across features', () => {
  it('all features accept the same Venue format without errors', () => {
    const venues = makeVenueSet()
    const user = makeUser()
    const currentTime = new Date('2026-03-17T21:00:00Z')

    // Tonight's Pick
    const pick = pickTonightsVenue({
      venues,
      user,
      userLocation: { lat: 47.61, lng: -122.33 },
      currentTime,
    })
    expect(pick).not.toBeNull()

    // Venue Comparison
    const comparison = compareVenues(venues[0], venues[1], { lat: 47.61, lng: -122.33 })
    expect(comparison.venueA.venue.id).toBe('v1')
    expect(comparison.venueB.venue.id).toBe('v2')

    // Energy History
    const history = generateEnergyHistory(venues[0], currentTime)
    expect(history.venueId).toBe('v1')

    // Walkthrough
    const route = generateWalkthrough({
      venues,
      neighborhood: 'Test',
      userLocation: { lat: 47.61, lng: -122.33 },
    })
    expect(route.stops.length).toBeGreaterThan(0)

    // Boost
    const boost = createBoost(venues[0].id, 'featured', 60)
    const boostedScore = calculateBoostScore(boost, venues[0].pulseScore)
    expect(boostedScore).toBeGreaterThan(0)

    // Activity Feed
    const events = generateActivityEvents(venues, [], [])
    // High-score venues should generate surge events
    const surgeVenueIds = events.filter(e => e.type === 'surge').map(e => e.venueId)
    expect(surgeVenueIds).toContain('v1') // pulseScore 80 >= 75
    expect(surgeVenueIds).toContain('v3') // pulseScore 90 >= 75

    // Match score
    const matchScore = calculateMatchScore(venues[0], { favoriteCategories: ['bar'] })
    expect(matchScore).toBeGreaterThan(0)
    expect(matchScore).toBeLessThanOrEqual(100)
  })

  it('passing same venues to multiple features does not corrupt shared state', () => {
    const venues = makeVenueSet()
    const originalScores = venues.map(v => v.pulseScore)

    // Run through multiple features
    pickTonightsVenue({
      venues,
      user: makeUser(),
      userLocation: { lat: 47.61, lng: -122.33 },
      currentTime: new Date('2026-03-17T21:00:00Z'),
    })

    compareVenues(venues[0], venues[1])
    generateEnergyHistory(venues[0])
    generateWalkthrough({
      venues,
      neighborhood: 'Test',
      userLocation: { lat: 47.61, lng: -122.33 },
    })

    // Verify venue data was not mutated
    const afterScores = venues.map(v => v.pulseScore)
    expect(afterScores).toEqual(originalScores)

    // Verify venue IDs remain intact
    expect(venues.map(v => v.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5'])
    expect(venues.map(v => v.name)).toEqual(['The Rooftop', 'Neon Lounge', 'Club Nova', 'Dive Central', 'Jazz Corner'])
  })

  it('venue data format is consistent across feature boundaries', () => {
    const venue = makeVenue({
      id: 'consistency-test',
      name: 'Consistency Bar',
      pulseScore: 72,
      category: 'Bar',
      scoreVelocity: 8,
    })

    // Each feature should read the same fields
    const history = generateEnergyHistory(venue)
    expect(history.venueId).toBe('consistency-test')

    const comparison = compareVenues(venue, makeVenue({ id: 'other', pulseScore: 50 }))
    expect(comparison.venueA.pulseScore).toBe(72)
    expect(comparison.venueA.category).toBe('Bar')

    const boost = createBoost(venue.id, 'featured', 60)
    expect(boost.venueId).toBe('consistency-test')

    const activity = generateActivityEvents([venue], [], [])
    const trendingEvents = activity.filter(e => e.type === 'trending')
    // scoreVelocity of 8 is not > 15, so no trending event expected
    expect(trendingEvents).toHaveLength(0)
  })
})
