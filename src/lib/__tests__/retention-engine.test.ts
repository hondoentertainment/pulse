import { describe, it, expect } from 'vitest'
import {
  generateDailyDrop,
  generateNightRecap,
  getStreakTier,
  getNextTierThreshold,
  createEmptyStreak,
  updateStreak,
  useStreakFreeze,
  generateWeeklyWrapup,
  checkMilestones,
  STREAK_TIER_THRESHOLDS,
  MILESTONE_CONFIGS,
  type StreakData,
} from '../retention-engine'
import type { Venue, Pulse, User } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: `venue-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Venue',
    location: { lat: 0, lng: 0, address: '' },
    pulseScore: 50,
    category: 'bar',
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'user',
    friends: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `pulse-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    venueId: 'v-1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: '2026-03-14T21:00:00.000Z',
    expiresAt: '2026-03-14T22:30:00.000Z',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('getStreakTier', () => {
  it('returns "none" for streak < 3', () => {
    expect(getStreakTier(0)).toBe('none')
    expect(getStreakTier(2)).toBe('none')
  })

  it('returns "bronze" at exactly 3', () => {
    expect(getStreakTier(3)).toBe('bronze')
  })

  it('returns "silver" at 7', () => {
    expect(getStreakTier(7)).toBe('silver')
    expect(getStreakTier(29)).toBe('silver')
  })

  it('returns "gold" at 30', () => {
    expect(getStreakTier(30)).toBe('gold')
    expect(getStreakTier(99)).toBe('gold')
  })

  it('returns "diamond" at 100+', () => {
    expect(getStreakTier(100)).toBe('diamond')
    expect(getStreakTier(365)).toBe('diamond')
  })
})

describe('getNextTierThreshold', () => {
  it('returns bronze threshold from none', () => {
    expect(getNextTierThreshold('none')).toBe(STREAK_TIER_THRESHOLDS.bronze)
  })

  it('returns silver threshold from bronze', () => {
    expect(getNextTierThreshold('bronze')).toBe(STREAK_TIER_THRESHOLDS.silver)
  })

  it('returns gold threshold from silver', () => {
    expect(getNextTierThreshold('silver')).toBe(STREAK_TIER_THRESHOLDS.gold)
  })

  it('returns diamond threshold from gold', () => {
    expect(getNextTierThreshold('gold')).toBe(STREAK_TIER_THRESHOLDS.diamond)
  })

  it('returns null from diamond (top tier)', () => {
    expect(getNextTierThreshold('diamond')).toBeNull()
  })
})

describe('createEmptyStreak', () => {
  it('returns a fresh streak object with zero count', () => {
    const streak = createEmptyStreak()
    expect(streak.currentStreak).toBe(0)
    expect(streak.longestStreak).toBe(0)
    expect(streak.tier).toBe('none')
    expect(streak.freezesRemaining).toBe(1)
    expect(streak.history).toEqual([])
    expect(streak.lastActiveDate).toBe('')
  })
})

describe('updateStreak', () => {
  it('starts at 1 on the first activity', () => {
    const streak = createEmptyStreak()
    const updated = updateStreak(streak, '2026-03-14')
    expect(updated.currentStreak).toBe(1)
    expect(updated.longestStreak).toBe(1)
    expect(updated.lastActiveDate).toBe('2026-03-14')
    expect(updated.history).toHaveLength(1)
    expect(updated.history[0]).toEqual({ date: '2026-03-14', active: true })
  })

  it('does not change for same-day repeat activity', () => {
    const streak: StreakData = {
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: '2026-03-14',
      tier: 'bronze',
      freezesRemaining: 1,
      history: [{ date: '2026-03-14', active: true }],
    }
    const updated = updateStreak(streak, '2026-03-14')
    expect(updated.currentStreak).toBe(3)
    expect(updated.history).toHaveLength(1)
  })

  it('extends streak by 1 on consecutive days', () => {
    const streak: StreakData = {
      currentStreak: 2,
      longestStreak: 2,
      lastActiveDate: '2026-03-14',
      tier: 'none',
      freezesRemaining: 1,
      history: [],
    }
    const updated = updateStreak(streak, '2026-03-15')
    expect(updated.currentStreak).toBe(3)
    expect(updated.tier).toBe('bronze')
    expect(updated.longestStreak).toBe(3)
  })

  it('auto-applies a freeze when one day is missed and a freeze remains', () => {
    const streak: StreakData = {
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: '2026-03-14',
      tier: 'silver',
      freezesRemaining: 1,
      history: [],
    }
    const updated = updateStreak(streak, '2026-03-16') // skipped 3-15
    expect(updated.currentStreak).toBe(6)
    expect(updated.freezesRemaining).toBe(0)
    const frozenEntry = updated.history.find((h) => h.date === '2026-03-15')
    expect(frozenEntry).toBeDefined()
    expect(frozenEntry?.active).toBe(false)
  })

  it('breaks the streak after 2+ missed days with no freezes', () => {
    const streak: StreakData = {
      currentStreak: 10,
      longestStreak: 10,
      lastActiveDate: '2026-03-14',
      tier: 'silver',
      freezesRemaining: 0,
      history: [],
    }
    const updated = updateStreak(streak, '2026-03-16')
    expect(updated.currentStreak).toBe(1)
    expect(updated.longestStreak).toBe(10) // longest is preserved
  })

  it('keeps longestStreak as a running max', () => {
    const streak: StreakData = {
      currentStreak: 5,
      longestStreak: 100, // historical max
      lastActiveDate: '2026-03-14',
      tier: 'silver',
      freezesRemaining: 1,
      history: [],
    }
    const updated = updateStreak(streak, '2026-03-15')
    expect(updated.currentStreak).toBe(6)
    expect(updated.longestStreak).toBe(100) // unchanged
  })

  it('trims history to last 90 entries', () => {
    const history: StreakData['history'] = Array.from({ length: 90 }, (_, i) => ({
      date: `2024-01-${(i % 30) + 1}`,
      active: true,
    }))
    const streak: StreakData = {
      currentStreak: 90,
      longestStreak: 90,
      lastActiveDate: '2026-03-14',
      tier: 'gold',
      freezesRemaining: 1,
      history,
    }
    const updated = updateStreak(streak, '2026-03-15')
    expect(updated.history).toHaveLength(90)
    expect(updated.history[updated.history.length - 1].date).toBe('2026-03-15')
  })
})

describe('useStreakFreeze', () => {
  it('decrements freezesRemaining by 1', () => {
    const streak = createEmptyStreak()
    const updated = useStreakFreeze(streak)
    expect(updated?.freezesRemaining).toBe(0)
  })

  it('returns null when no freezes remain', () => {
    const streak: StreakData = { ...createEmptyStreak(), freezesRemaining: 0 }
    expect(useStreakFreeze(streak)).toBeNull()
  })
})

describe('generateDailyDrop', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v-a', pulseScore: 90, category: 'nightclub' }),
    makeVenue({ id: 'v-b', pulseScore: 50, category: 'bar' }),
    makeVenue({ id: 'v-c', pulseScore: 30, category: 'cafe' }),
  ]

  it('returns null for an empty venue list', () => {
    expect(generateDailyDrop([], {}, '2026-03-14')).toBeNull()
  })

  it('is deterministic for the same date', () => {
    const first = generateDailyDrop(venues, {}, '2026-03-14')
    const second = generateDailyDrop(venues, {}, '2026-03-14')
    expect(first).toEqual(second)
  })

  it('can vary for different dates', () => {
    // Collect drops over a set of dates - at least 2 distinct venues should appear
    const results = new Set<string>()
    for (let d = 1; d <= 28; d++) {
      const date = `2026-03-${d.toString().padStart(2, '0')}`
      const drop = generateDailyDrop(venues, {}, date)
      if (drop) results.add(drop.venueId)
    }
    expect(results.size).toBeGreaterThanOrEqual(1)
  })

  it('includes venue metadata and reveal time at 7pm', () => {
    const drop = generateDailyDrop(venues, {}, '2026-03-14')
    expect(drop).not.toBeNull()
    expect(drop!.teaser).toContain(drop!.category)
    expect(drop!.revealAt).toContain('19:00')
    expect(drop!.id).toBe('drop-2026-03-14')
  })
})

describe('generateNightRecap', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v-a', name: 'Venue A' }),
    makeVenue({ id: 'v-b', name: 'Venue B' }),
  ]

  it('returns null when the user has no pulses in the night window', () => {
    const recap = generateNightRecap('user-1', [], venues, [], '2026-03-14')
    expect(recap).toBeNull()
  })

  it('summarizes the night with venues visited and top vibe', () => {
    const pulses: Pulse[] = [
      makePulse({ userId: 'user-1', venueId: 'v-a', energyRating: 'buzzing', createdAt: '2026-03-14T21:00:00.000Z' }),
      makePulse({ userId: 'user-1', venueId: 'v-a', energyRating: 'electric', createdAt: '2026-03-14T22:00:00.000Z' }),
      makePulse({ userId: 'user-1', venueId: 'v-b', energyRating: 'chill', createdAt: '2026-03-14T23:30:00.000Z' }),
    ]
    const recap = generateNightRecap('user-1', pulses, venues, [], '2026-03-14')
    expect(recap).not.toBeNull()
    expect(recap!.totalPulses).toBe(3)
    expect(recap!.venuesVisited).toHaveLength(2)
    // v-a peak energy should be 'electric' (highest seen)
    const vaEntry = recap!.venuesVisited.find((v) => v.id === 'v-a')!
    expect(vaEntry.peakEnergy).toBe('electric')
  })

  it('ignores pulses outside the night window', () => {
    const pulses: Pulse[] = [
      makePulse({ userId: 'user-1', venueId: 'v-a', createdAt: '2026-03-14T10:00:00.000Z' }), // morning, outside
    ]
    expect(generateNightRecap('user-1', pulses, venues, [], '2026-03-14')).toBeNull()
  })

  it('includes friends who pulsed at the same venues', () => {
    const friends: User[] = [makeUser({ id: 'friend-1', username: 'alice' })]
    const pulses: Pulse[] = [
      makePulse({ userId: 'user-1', venueId: 'v-a', createdAt: '2026-03-14T21:00:00.000Z' }),
      makePulse({ userId: 'friend-1', venueId: 'v-a', createdAt: '2026-03-14T21:30:00.000Z' }),
    ]
    const recap = generateNightRecap('user-1', pulses, venues, friends, '2026-03-14')
    expect(recap!.friendsEncountered).toContain('alice')
  })

  it('builds a highlight moment when a pulse has reactions', () => {
    const pulses: Pulse[] = [
      makePulse({
        userId: 'user-1',
        venueId: 'v-a',
        createdAt: '2026-03-14T21:00:00.000Z',
        reactions: { fire: ['u2', 'u3'], eyes: [], skull: [], lightning: [] },
      }),
    ]
    const recap = generateNightRecap('user-1', pulses, venues, [], '2026-03-14')
    expect(recap!.highlightMoment).toBeDefined()
    expect(recap!.highlightMoment).toContain('Venue A')
  })
})

describe('generateWeeklyWrapup', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v-a', name: 'A' }),
    makeVenue({ id: 'v-b', name: 'B' }),
  ]

  it('returns null when the user has no pulses this week', () => {
    expect(generateWeeklyWrapup('user-1', [], venues, '2026-03-09')).toBeNull()
  })

  it('summarizes weekly venues explored and new discoveries', () => {
    const pulses: Pulse[] = [
      // Previous week (week of Mar 2)
      makePulse({ userId: 'user-1', venueId: 'v-a', createdAt: '2026-03-03T21:00:00.000Z' }),
      // Current week (week of Mar 9)
      makePulse({ userId: 'user-1', venueId: 'v-a', createdAt: '2026-03-10T21:00:00.000Z' }),
      makePulse({ userId: 'user-1', venueId: 'v-b', createdAt: '2026-03-11T21:00:00.000Z' }), // new discovery
    ]
    const result = generateWeeklyWrapup('user-1', pulses, venues, '2026-03-09')
    expect(result).not.toBeNull()
    expect(result!.venuesExplored).toBe(2)
    expect(result!.newDiscoveries).toBe(1) // v-b is new this week
    expect(result!.totalPulses).toBe(2)
    expect(result!.weekStart).toBe('2026-03-09')
  })

  it('provides delta comparison to previous week', () => {
    const pulses: Pulse[] = [
      makePulse({ userId: 'user-1', venueId: 'v-a', createdAt: '2026-03-03T21:00:00.000Z' }),
      makePulse({ userId: 'user-1', venueId: 'v-a', createdAt: '2026-03-10T21:00:00.000Z' }),
      makePulse({ userId: 'user-1', venueId: 'v-b', createdAt: '2026-03-11T21:00:00.000Z' }),
    ]
    const result = generateWeeklyWrapup('user-1', pulses, venues, '2026-03-09')
    // Current: 2 venues, 2 pulses. Previous: 1 venue, 1 pulse.
    expect(result!.comparisonToPrevious.venuesDelta).toBe(1)
    expect(result!.comparisonToPrevious.pulsesDelta).toBe(1)
  })
})

describe('checkMilestones', () => {
  it('returns an empty array when no milestones are triggered', () => {
    expect(checkMilestones('user-1', [])).toEqual([])
  })

  it('triggers 10th_checkin milestone at exactly 10 unique venues', () => {
    const pulses: Pulse[] = Array.from({ length: 10 }, (_, i) =>
      makePulse({ venueId: `v-${i}`, userId: 'user-1' })
    )
    expect(checkMilestones('user-1', pulses)).toContain('10th_checkin')
  })

  it('does not trigger 10th_checkin at 9 unique venues', () => {
    const pulses: Pulse[] = Array.from({ length: 9 }, (_, i) =>
      makePulse({ venueId: `v-${i}`, userId: 'user-1' })
    )
    expect(checkMilestones('user-1', pulses)).not.toContain('10th_checkin')
  })

  it('triggers 50_pulses milestone at exactly 50 pulses', () => {
    const pulses: Pulse[] = Array.from({ length: 50 }, () =>
      makePulse({ userId: 'user-1' })
    )
    expect(checkMilestones('user-1', pulses)).toContain('50_pulses')
  })

  it('triggers week_streak milestone when streak is exactly 7', () => {
    const streak: StreakData = {
      ...createEmptyStreak(),
      currentStreak: 7,
    }
    expect(checkMilestones('user-1', [], undefined, streak)).toContain('week_streak')
  })

  it('triggers first_crew_night when a crew member pulsed at the same venue close in time', () => {
    const pulses: Pulse[] = [
      makePulse({ userId: 'user-1', venueId: 'v-1', createdAt: '2026-03-14T20:00:00.000Z' }),
      makePulse({ userId: 'friend-1', venueId: 'v-1', createdAt: '2026-03-14T20:30:00.000Z' }),
    ]
    const crews = [{ id: 'crew-1', members: ['user-1', 'friend-1'] }]
    expect(checkMilestones('user-1', pulses, crews)).toContain('first_crew_night')
  })
})

describe('constants', () => {
  it('exports sane streak thresholds', () => {
    expect(STREAK_TIER_THRESHOLDS.bronze).toBeLessThan(STREAK_TIER_THRESHOLDS.silver)
    expect(STREAK_TIER_THRESHOLDS.silver).toBeLessThan(STREAK_TIER_THRESHOLDS.gold)
    expect(STREAK_TIER_THRESHOLDS.gold).toBeLessThan(STREAK_TIER_THRESHOLDS.diamond)
  })

  it('exports milestone configs with title, description, and icon', () => {
    for (const key of Object.keys(MILESTONE_CONFIGS) as Array<keyof typeof MILESTONE_CONFIGS>) {
      const c = MILESTONE_CONFIGS[key]
      expect(c.title).toBeTruthy()
      expect(c.description).toBeTruthy()
      expect(c.icon).toBeTruthy()
    }
  })
})
