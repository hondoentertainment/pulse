import { describe, expect, it } from 'vitest'
import {
  milestoneCopy,
  milestoneForStreak,
  milestoneNudge,
  milestoneProgress,
  nextMilestone,
  shouldCelebrate,
  STREAK_MILESTONES,
} from '@/lib/signal-milestones'

describe('milestoneForStreak / nextMilestone', () => {
  it('returns the highest reached milestone and the next one ahead', () => {
    expect(milestoneForStreak(0)).toBeNull()
    expect(milestoneForStreak(2)).toBeNull()
    expect(milestoneForStreak(3)).toBe(3)
    expect(milestoneForStreak(13)).toBe(7)
    expect(milestoneForStreak(150)).toBe(100)

    expect(nextMilestone(0)).toBe(3)
    expect(nextMilestone(3)).toBe(7)
    expect(nextMilestone(29)).toBe(30)
    expect(nextMilestone(100)).toBeNull()
  })
})

describe('milestoneProgress', () => {
  it('measures progress between the reached and next milestone', () => {
    expect(milestoneProgress(0)).toEqual({ current: null, next: 3, remaining: 3, percent: 0 })
    expect(milestoneProgress(5)).toEqual({ current: 3, next: 7, remaining: 2, percent: 50 })
    expect(milestoneProgress(7)).toEqual({ current: 7, next: 14, remaining: 7, percent: 0 })
  })

  it('caps at 100 percent once past the final milestone', () => {
    expect(milestoneProgress(120)).toEqual({ current: 100, next: null, remaining: 0, percent: 100 })
  })
})

describe('shouldCelebrate', () => {
  it('celebrates a newly reached milestone exactly once', () => {
    expect(shouldCelebrate(2, null)).toBeNull()
    expect(shouldCelebrate(3, null)).toBe(3)
    expect(shouldCelebrate(3, 3)).toBeNull()
    expect(shouldCelebrate(6, 3)).toBeNull()
    expect(shouldCelebrate(7, 3)).toBe(7)
  })

  it('jumps straight to the highest reached milestone after a gap in celebrations', () => {
    expect(shouldCelebrate(31, 3)).toBe(30)
  })

  it('does not re-celebrate after a streak resets and climbs back', () => {
    // Celebrated 7 already; streak reset and is now back at 4 -> reached 3, which is below 7.
    expect(shouldCelebrate(4, 7)).toBeNull()
  })
})

describe('copy', () => {
  it('has copy for every milestone', () => {
    for (const milestone of STREAK_MILESTONES) {
      const copy = milestoneCopy(milestone)
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.body.length).toBeGreaterThan(0)
    }
  })

  it('nudges toward the next milestone', () => {
    expect(milestoneNudge(0)).toMatch(/Log today to start toward a 3-day streak/)
    expect(milestoneNudge(6)).toBe('1 more day to a 7-day streak.')
    expect(milestoneNudge(10)).toBe('4 more days to a 14-day streak.')
    expect(milestoneNudge(100)).toMatch(/Past every milestone/)
  })
})
