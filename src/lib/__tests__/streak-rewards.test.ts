import { describe, it, expect } from 'vitest'
import type { Pulse, User } from '../types'
import {
  checkStreakProgress,
  calculateStreakExpiry,
  getNextMilestone,
  getProgressToNextMilestone,
  generateStreakNotification,
  buildFriendLeaderboard,
  getStreakMultiplier,
  isAtRisk,
  calculateTotalXP,
  getAchievedMilestones,
  STREAK_DEFINITIONS,
  MILESTONES,
  type Streak,
  type StreakType,
} from '../streak-rewards'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'alice',
    friends: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeStreak(overrides: Partial<Streak> = {}): Streak {
  return {
    userId: 'u1',
    type: 'weekly_checkin',
    currentCount: 5,
    longestCount: 5,
    lastActivity: new Date().toISOString(),
    isActive: true,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

/** Create a date on a specific day offset from a base Monday. */
function dateOnDay(weekOffset: number, dayOfWeek: number, hour: number = 12): Date {
  // Start from a known Monday: 2025-01-06
  const base = new Date('2025-01-06T00:00:00Z')
  const d = new Date(base)
  d.setDate(base.getDate() + weekOffset * 7 + dayOfWeek)
  d.setHours(hour, 0, 0, 0)
  return d
}

describe('checkStreakProgress', () => {
  it('returns a streak entry for each streak type', () => {
    const streaks = checkStreakProgress('u1', [])
    expect(streaks.length).toBe(STREAK_DEFINITIONS.length)
    for (const s of streaks) {
      expect(s.userId).toBe('u1')
      expect(s.currentCount).toBe(0)
      expect(s.isActive).toBe(false)
    }
  })

  it('calculates weekly_checkin streak across consecutive weeks', () => {
    const pulses = [0, 1, 2, 3].map(w =>
      makePulse({
        createdAt: dateOnDay(w, 2, 14).toISOString(), // Wednesday afternoon
      })
    )
    const now = dateOnDay(3, 4, 14) // Thursday of the 4th week
    const streaks = checkStreakProgress('u1', pulses, now)
    const weekly = streaks.find(s => s.type === 'weekly_checkin')!
    expect(weekly.currentCount).toBeGreaterThanOrEqual(3)
    expect(weekly.isActive).toBe(true)
  })

  it('calculates weekend_warrior streak for Friday-Sunday checkins', () => {
    // Fri=5, Sat=6, Sun=0
    const pulses = [0, 1, 2].map(w =>
      makePulse({
        createdAt: dateOnDay(w, 5, 22).toISOString(), // Friday night each week
      })
    )
    const now = dateOnDay(2, 6, 14) // Saturday of week 3
    const streaks = checkStreakProgress('u1', pulses, now)
    const weekend = streaks.find(s => s.type === 'weekend_warrior')!
    expect(weekend.currentCount).toBeGreaterThanOrEqual(2)
    expect(weekend.isActive).toBe(true)
  })

  it('calculates explorer streak for new venue each period', () => {
    const pulses = [0, 1, 2, 3].map(w =>
      makePulse({
        venueId: `venue-${w}`,
        createdAt: dateOnDay(w, 3, 14).toISOString(),
      })
    )
    const now = dateOnDay(3, 5, 14)
    const streaks = checkStreakProgress('u1', pulses, now)
    const explorer = streaks.find(s => s.type === 'explorer')!
    expect(explorer.currentCount).toBeGreaterThanOrEqual(3)
    expect(explorer.isActive).toBe(true)
  })

  it('calculates night_owl streak for after-midnight checkins', () => {
    const pulses = [0, 1, 2].map(w =>
      makePulse({
        createdAt: dateOnDay(w, 5, 2).toISOString(), // 2 AM Saturday
      })
    )
    const now = dateOnDay(2, 6, 14)
    const streaks = checkStreakProgress('u1', pulses, now)
    const nightOwl = streaks.find(s => s.type === 'night_owl')!
    expect(nightOwl.currentCount).toBeGreaterThanOrEqual(2)
    expect(nightOwl.isActive).toBe(true)
  })

  it('calculates early_bird streak for before-6PM checkins', () => {
    const pulses = [0, 1, 2].map(w =>
      makePulse({
        createdAt: dateOnDay(w, 3, 10).toISOString(), // 10 AM
      })
    )
    const now = dateOnDay(2, 5, 10)
    const streaks = checkStreakProgress('u1', pulses, now)
    const earlyBird = streaks.find(s => s.type === 'early_bird')!
    expect(earlyBird.currentCount).toBeGreaterThanOrEqual(2)
    expect(earlyBird.isActive).toBe(true)
  })

  it('calculates venue_loyal streak for repeat visits to same venue', () => {
    // Venue loyal has 14-day periods, so spread across biweeks
    const pulses = [0, 2, 4, 6].map(w =>
      makePulse({
        venueId: 'loyal-spot',
        createdAt: dateOnDay(w, 2, 14).toISOString(),
      })
    )
    const now = dateOnDay(6, 5, 14)
    const streaks = checkStreakProgress('u1', pulses, now)
    const venuLoyal = streaks.find(s => s.type === 'venue_loyal')!
    expect(venuLoyal.currentCount).toBeGreaterThanOrEqual(1)
  })

  it('breaks streak when gap is too long', () => {
    const pulses = [
      makePulse({ createdAt: dateOnDay(0, 2, 14).toISOString() }),
      makePulse({ createdAt: dateOnDay(1, 2, 14).toISOString() }),
      // Gap of 3 weeks (exceeds 7-day expiry)
      makePulse({ createdAt: dateOnDay(5, 2, 14).toISOString() }),
    ]
    const now = dateOnDay(5, 4, 14)
    const streaks = checkStreakProgress('u1', pulses, now)
    const weekly = streaks.find(s => s.type === 'weekly_checkin')!
    expect(weekly.currentCount).toBe(1)
  })

  it('returns zero for new user with no history', () => {
    const streaks = checkStreakProgress('new-user', [])
    for (const s of streaks) {
      expect(s.currentCount).toBe(0)
      expect(s.longestCount).toBe(0)
      expect(s.isActive).toBe(false)
    }
  })

  it('tracks longestCount separately from currentCount', () => {
    const pulses = [
      // First run of 3 consecutive weeks
      makePulse({ createdAt: dateOnDay(0, 2, 14).toISOString() }),
      makePulse({ createdAt: dateOnDay(1, 2, 14).toISOString() }),
      makePulse({ createdAt: dateOnDay(2, 2, 14).toISOString() }),
      // Gap
      // New run of 1
      makePulse({ createdAt: dateOnDay(5, 2, 14).toISOString() }),
    ]
    const now = dateOnDay(5, 4, 14)
    const streaks = checkStreakProgress('u1', pulses, now)
    const weekly = streaks.find(s => s.type === 'weekly_checkin')!
    expect(weekly.currentCount).toBe(1)
    expect(weekly.longestCount).toBeGreaterThanOrEqual(3)
  })
})

describe('calculateStreakExpiry', () => {
  it('returns empty string for no last activity', () => {
    expect(calculateStreakExpiry('weekly_checkin', '')).toBe('')
  })

  it('calculates 7-day expiry for weekly_checkin', () => {
    const lastActivity = '2025-03-10T12:00:00Z'
    const expiry = calculateStreakExpiry('weekly_checkin', lastActivity)
    const expiryDate = new Date(expiry)
    const expectedDate = new Date('2025-03-17T12:00:00Z')
    expect(expiryDate.getTime()).toBe(expectedDate.getTime())
  })

  it('calculates 9-day expiry for weekend_warrior', () => {
    const lastActivity = '2025-03-10T12:00:00Z'
    const expiry = calculateStreakExpiry('weekend_warrior', lastActivity)
    const expiryDate = new Date(expiry)
    const lastDate = new Date(lastActivity)
    const diffDays = (expiryDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBe(9)
  })

  it('calculates 14-day expiry for venue_loyal', () => {
    const lastActivity = '2025-03-10T12:00:00Z'
    const expiry = calculateStreakExpiry('venue_loyal', lastActivity)
    const expiryDate = new Date(expiry)
    const lastDate = new Date(lastActivity)
    const diffDays = (expiryDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBe(14)
  })
})

describe('getNextMilestone', () => {
  it('returns 3 for a count of 0', () => {
    const streak = makeStreak({ currentCount: 0 })
    expect(getNextMilestone(streak)).toBe(3)
  })

  it('returns 3 for a count of 2', () => {
    const streak = makeStreak({ currentCount: 2 })
    expect(getNextMilestone(streak)).toBe(3)
  })

  it('returns 5 for a count of 3', () => {
    const streak = makeStreak({ currentCount: 3 })
    expect(getNextMilestone(streak)).toBe(5)
  })

  it('returns 10 for a count of 5', () => {
    const streak = makeStreak({ currentCount: 5 })
    expect(getNextMilestone(streak)).toBe(10)
  })

  it('returns 25 for a count of 10', () => {
    const streak = makeStreak({ currentCount: 10 })
    expect(getNextMilestone(streak)).toBe(25)
  })

  it('returns 50 for a count of 25', () => {
    const streak = makeStreak({ currentCount: 25 })
    expect(getNextMilestone(streak)).toBe(50)
  })

  it('returns 100 for a count of 50', () => {
    const streak = makeStreak({ currentCount: 50 })
    expect(getNextMilestone(streak)).toBe(100)
  })

  it('returns null for a count of 100 (all milestones achieved)', () => {
    const streak = makeStreak({ currentCount: 100 })
    expect(getNextMilestone(streak)).toBeNull()
  })

  it('returns null for a count over 100', () => {
    const streak = makeStreak({ currentCount: 150 })
    expect(getNextMilestone(streak)).toBeNull()
  })
})

describe('getProgressToNextMilestone', () => {
  it('returns 0.0 for count of 0', () => {
    const streak = makeStreak({ currentCount: 0 })
    expect(getProgressToNextMilestone(streak)).toBe(0.0)
  })

  it('returns ~0.67 for count of 2 (next milestone is 3)', () => {
    const streak = makeStreak({ currentCount: 2 })
    const progress = getProgressToNextMilestone(streak)
    expect(progress).toBeCloseTo(2 / 3, 2)
  })

  it('returns 0.5 for count of 4 (between 3 and 5)', () => {
    const streak = makeStreak({ currentCount: 4 })
    const progress = getProgressToNextMilestone(streak)
    // (4-3)/(5-3) = 0.5
    expect(progress).toBeCloseTo(0.5, 2)
  })

  it('returns 1.0 when all milestones achieved', () => {
    const streak = makeStreak({ currentCount: 100 })
    expect(getProgressToNextMilestone(streak)).toBe(1.0)
  })

  it('returns a value between 0 and 1 for mid-range counts', () => {
    const streak = makeStreak({ currentCount: 15 })
    const progress = getProgressToNextMilestone(streak)
    expect(progress).toBeGreaterThan(0)
    expect(progress).toBeLessThan(1)
    // (15-10)/(25-10) = 5/15 = 1/3
    expect(progress).toBeCloseTo(1 / 3, 2)
  })
})

describe('generateStreakNotification', () => {
  it('generates notification for weekly_checkin milestone 5', () => {
    const streak = makeStreak({ type: 'weekly_checkin', currentCount: 5 })
    const msg = generateStreakNotification(streak, 5)
    expect(msg).toContain('5')
    expect(msg).toContain('weekly regular')
    expect(msg).toContain('unlocked')
  })

  it('generates notification for weekend_warrior milestone 10', () => {
    const streak = makeStreak({ type: 'weekend_warrior', currentCount: 10 })
    const msg = generateStreakNotification(streak, 10)
    expect(msg).toContain('10')
    expect(msg).toContain('Weekend Veteran')
  })

  it('returns empty string for unknown streak type', () => {
    const streak = makeStreak({ type: 'unknown_type' as StreakType })
    const msg = generateStreakNotification(streak, 5)
    expect(msg).toBe('')
  })
})

describe('buildFriendLeaderboard', () => {
  it('ranks friends by streak count descending', () => {
    const friends = [
      makeUser({ id: 'f1', username: 'bob' }),
      makeUser({ id: 'f2', username: 'charlie' }),
    ]
    const streaks: Streak[] = [
      makeStreak({ userId: 'u1', type: 'weekly_checkin', currentCount: 5 }),
      makeStreak({ userId: 'f1', type: 'weekly_checkin', currentCount: 10 }),
      makeStreak({ userId: 'f2', type: 'weekly_checkin', currentCount: 3 }),
    ]
    const board = buildFriendLeaderboard('u1', friends, streaks, 'weekly_checkin')

    expect(board[0].user.id).toBe('f1')
    expect(board[0].rank).toBe(1)
    expect(board[0].count).toBe(10)

    expect(board[1].rank).toBe(2)
    expect(board[2].rank).toBe(3)
  })

  it('assigns same rank for ties', () => {
    const friends = [
      makeUser({ id: 'f1', username: 'bob' }),
      makeUser({ id: 'f2', username: 'charlie' }),
    ]
    const streaks: Streak[] = [
      makeStreak({ userId: 'u1', type: 'weekly_checkin', currentCount: 5 }),
      makeStreak({ userId: 'f1', type: 'weekly_checkin', currentCount: 5 }),
      makeStreak({ userId: 'f2', type: 'weekly_checkin', currentCount: 3 }),
    ]
    const board = buildFriendLeaderboard('u1', friends, streaks, 'weekly_checkin')

    // Both with 5 should be rank 1
    const rank1 = board.filter(e => e.rank === 1)
    expect(rank1.length).toBe(2)
    // Charlie with 3 should be rank 3 (not 2)
    const charlie = board.find(e => e.user.id === 'f2')!
    expect(charlie.rank).toBe(3)
  })

  it('highlights current user in the leaderboard', () => {
    const friends = [makeUser({ id: 'f1', username: 'bob' })]
    const streaks: Streak[] = [
      makeStreak({ userId: 'u1', type: 'weekly_checkin', currentCount: 5 }),
      makeStreak({ userId: 'f1', type: 'weekly_checkin', currentCount: 10 }),
    ]
    const board = buildFriendLeaderboard('u1', friends, streaks, 'weekly_checkin')
    const currentUser = board.find(e => e.isCurrentUser)
    expect(currentUser).toBeDefined()
    expect(currentUser!.count).toBe(5)
  })

  it('adds current user even if not in friends list', () => {
    const friends = [makeUser({ id: 'f1', username: 'bob' })]
    const streaks: Streak[] = [
      makeStreak({ userId: 'u1', type: 'weekly_checkin', currentCount: 7 }),
      makeStreak({ userId: 'f1', type: 'weekly_checkin', currentCount: 3 }),
    ]
    const board = buildFriendLeaderboard('u1', friends, streaks, 'weekly_checkin')
    expect(board.some(e => e.isCurrentUser)).toBe(true)
    expect(board.length).toBe(2)
  })

  it('handles empty friends list', () => {
    const streaks: Streak[] = [
      makeStreak({ userId: 'u1', type: 'weekly_checkin', currentCount: 5 }),
    ]
    const board = buildFriendLeaderboard('u1', [], streaks, 'weekly_checkin')
    expect(board.length).toBe(1)
    expect(board[0].isCurrentUser).toBe(true)
    expect(board[0].rank).toBe(1)
  })
})

describe('getStreakMultiplier', () => {
  it('returns 1.0 for no active streaks', () => {
    expect(getStreakMultiplier([])).toBe(1.0)
  })

  it('returns 1.0 for all inactive streaks', () => {
    const streaks = [makeStreak({ isActive: false }), makeStreak({ isActive: false })]
    expect(getStreakMultiplier(streaks)).toBe(1.0)
  })

  it('returns 1.5 for 1 active streak', () => {
    const streaks = [makeStreak({ isActive: true })]
    expect(getStreakMultiplier(streaks)).toBe(1.5)
  })

  it('returns 1.5 for 2 active streaks', () => {
    const streaks = [makeStreak({ isActive: true }), makeStreak({ isActive: true })]
    expect(getStreakMultiplier(streaks)).toBe(1.5)
  })

  it('returns 2.0 for 3 active streaks', () => {
    const streaks = Array.from({ length: 3 }, () => makeStreak({ isActive: true }))
    expect(getStreakMultiplier(streaks)).toBe(2.0)
  })

  it('returns 2.0 for 4 active streaks', () => {
    const streaks = Array.from({ length: 4 }, () => makeStreak({ isActive: true }))
    expect(getStreakMultiplier(streaks)).toBe(2.0)
  })

  it('returns 3.0 for 5 or more active streaks', () => {
    const streaks = Array.from({ length: 5 }, () => makeStreak({ isActive: true }))
    expect(getStreakMultiplier(streaks)).toBe(3.0)
  })

  it('returns 3.0 for 7 active streaks (all types)', () => {
    const streaks = Array.from({ length: 7 }, () => makeStreak({ isActive: true }))
    expect(getStreakMultiplier(streaks)).toBe(3.0)
  })
})

describe('isAtRisk', () => {
  it('returns false for inactive streak', () => {
    const streak = makeStreak({ isActive: false })
    expect(isAtRisk(streak)).toBe(false)
  })

  it('returns false for streak with empty expiresAt', () => {
    const streak = makeStreak({ isActive: true, expiresAt: '' })
    expect(isAtRisk(streak)).toBe(false)
  })

  it('returns true when streak expires within 24 hours', () => {
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12 hours
    const streak = makeStreak({ isActive: true, expiresAt })
    expect(isAtRisk(streak)).toBe(true)
  })

  it('returns true when streak expires in exactly 23 hours', () => {
    const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
    const streak = makeStreak({ isActive: true, expiresAt })
    expect(isAtRisk(streak)).toBe(true)
  })

  it('returns false when streak expires in more than 24 hours', () => {
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
    const streak = makeStreak({ isActive: true, expiresAt })
    expect(isAtRisk(streak)).toBe(false)
  })

  it('returns false when streak has already expired', () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString() // past
    const streak = makeStreak({ isActive: true, expiresAt })
    expect(isAtRisk(streak)).toBe(false)
  })
})

describe('calculateTotalXP', () => {
  it('returns 0 for no streaks', () => {
    expect(calculateTotalXP([])).toBe(0)
  })

  it('sums XP from achieved milestones', () => {
    const streaks = [
      makeStreak({ type: 'weekly_checkin', currentCount: 5, longestCount: 5 }),
    ]
    const xp = calculateTotalXP(streaks)
    // weekly_checkin milestones 3 and 5: 3*10 + 5*10 = 80
    expect(xp).toBe(80)
  })

  it('uses longestCount when higher than currentCount', () => {
    const streaks = [
      makeStreak({ type: 'weekly_checkin', currentCount: 2, longestCount: 10 }),
    ]
    const xp = calculateTotalXP(streaks)
    // Milestones 3, 5, 10: 30 + 50 + 100 = 180
    expect(xp).toBe(180)
  })
})

describe('getAchievedMilestones', () => {
  it('returns empty for count 0', () => {
    const streak = makeStreak({ currentCount: 0, longestCount: 0 })
    expect(getAchievedMilestones(streak)).toEqual([])
  })

  it('returns milestones up to current count', () => {
    const streak = makeStreak({ type: 'weekly_checkin', currentCount: 10, longestCount: 10 })
    const milestones = getAchievedMilestones(streak)
    const milestoneValues = milestones.map(m => m.milestone)
    expect(milestoneValues).toContain(3)
    expect(milestoneValues).toContain(5)
    expect(milestoneValues).toContain(10)
    expect(milestoneValues).not.toContain(25)
  })

  it('returns all milestones for user with all streaks maxed', () => {
    const streak = makeStreak({ type: 'weekend_warrior', currentCount: 100, longestCount: 100 })
    const milestones = getAchievedMilestones(streak)
    expect(milestones.length).toBe(MILESTONES.length)
  })
})

describe('edge cases', () => {
  it('handles user with only one check-in', () => {
    const pulses = [makePulse({ createdAt: new Date().toISOString() })]
    const streaks = checkStreakProgress('u1', pulses)
    // Should have at least one active streak (weekly_checkin)
    const weekly = streaks.find(s => s.type === 'weekly_checkin')!
    expect(weekly.currentCount).toBeGreaterThanOrEqual(1)
  })

  it('filters check-ins by userId', () => {
    const pulses = [
      makePulse({ userId: 'u1', createdAt: dateOnDay(0, 2, 14).toISOString() }),
      makePulse({ userId: 'u2', createdAt: dateOnDay(1, 2, 14).toISOString() }),
      makePulse({ userId: 'u1', createdAt: dateOnDay(1, 2, 14).toISOString() }),
    ]
    const now = dateOnDay(1, 4, 14)
    const streaksU1 = checkStreakProgress('u1', pulses, now)
    const streaksU2 = checkStreakProgress('u2', pulses, now)

    const weeklyU1 = streaksU1.find(s => s.type === 'weekly_checkin')!
    const weeklyU2 = streaksU2.find(s => s.type === 'weekly_checkin')!
    expect(weeklyU1.currentCount).toBeGreaterThanOrEqual(2)
    // u2 only has one check-in in week 1, so streak is 1
    expect(weeklyU2.currentCount).toBe(1)
  })

  it('handles duplicate check-ins in the same period gracefully', () => {
    const pulses = [
      makePulse({ createdAt: dateOnDay(0, 1, 10).toISOString() }),
      makePulse({ createdAt: dateOnDay(0, 2, 14).toISOString() }),
      makePulse({ createdAt: dateOnDay(0, 3, 20).toISOString() }),
      makePulse({ createdAt: dateOnDay(1, 1, 10).toISOString() }),
    ]
    const now = dateOnDay(1, 3, 14)
    const streaks = checkStreakProgress('u1', pulses, now)
    const weekly = streaks.find(s => s.type === 'weekly_checkin')!
    // Multiple check-ins in week 0 should still count as 1 period
    expect(weekly.currentCount).toBe(2)
  })
})
