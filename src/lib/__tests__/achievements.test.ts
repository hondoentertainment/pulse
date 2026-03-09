import { describe, it, expect } from 'vitest'
import {
  calculateAchievementProgress,
  calculateCheckInStreak,
  toggleShowcase,
  createWeeklyChallenge,
  calculateChallengeProgress,
  getAchievementById,
  ACHIEVEMENTS,
} from '../achievements'
import type { User, Pulse } from '../types'

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', username: 'alice', friends: [], createdAt: new Date().toISOString(), ...overrides }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1', venueId: 'v1', photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('calculateAchievementProgress', () => {
  it('returns progress for all achievements', () => {
    const user = makeUser()
    const progress = calculateAchievementProgress(user, [], [])
    expect(progress.length).toBe(ACHIEVEMENTS.length)
  })

  it('unlocks first_pulse after posting', () => {
    const user = makeUser()
    const pulses = [makePulse({ userId: 'u1' })]
    const progress = calculateAchievementProgress(user, pulses, pulses)
    const firstPulse = progress.find(p => p.achievementId === 'first_pulse')
    expect(firstPulse?.unlockedAt).not.toBe('')
    expect(firstPulse?.progress).toBe(1)
  })

  it('tracks unique venue exploration', () => {
    const user = makeUser()
    const pulses = Array.from({ length: 12 }, (_, i) =>
      makePulse({ userId: 'u1', venueId: `v${i}` })
    )
    const progress = calculateAchievementProgress(user, pulses, pulses)
    const explorer = progress.find(p => p.achievementId === 'explorer_10')
    expect(explorer?.unlockedAt).not.toBe('')
    expect(explorer?.progress).toBe(12)
  })

  it('tracks night owl pulses', () => {
    const user = makeUser()
    const pulses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setHours(2, i * 10, 0, 0)
      return makePulse({ userId: 'u1', createdAt: d.toISOString() })
    })
    const progress = calculateAchievementProgress(user, pulses, pulses)
    const nightOwl = progress.find(p => p.achievementId === 'night_owl_5')
    expect(nightOwl?.unlockedAt).not.toBe('')
  })

  it('tracks energy master (all 4 levels)', () => {
    const user = makeUser()
    const pulses = (['dead', 'chill', 'buzzing', 'electric'] as const).map(rating =>
      makePulse({ userId: 'u1', energyRating: rating })
    )
    const progress = calculateAchievementProgress(user, pulses, pulses)
    const master = progress.find(p => p.achievementId === 'energy_master')
    expect(master?.unlockedAt).not.toBe('')
  })

  it('tracks social butterfly', () => {
    const friends = Array.from({ length: 10 }, (_, i) => `f${i}`)
    const user = makeUser({ friends })
    const progress = calculateAchievementProgress(user, [], [])
    const social = progress.find(p => p.achievementId === 'social_butterfly')
    expect(social?.unlockedAt).not.toBe('')
  })

  it('tracks regular (repeat venue visits)', () => {
    const user = makeUser()
    const pulses = Array.from({ length: 6 }, () => makePulse({ userId: 'u1', venueId: 'v1' }))
    const progress = calculateAchievementProgress(user, pulses, pulses)
    const regular = progress.find(p => p.achievementId === 'regular_5')
    expect(regular?.unlockedAt).not.toBe('')
  })
})

describe('calculateCheckInStreak', () => {
  it('returns 0 for no pulses', () => {
    expect(calculateCheckInStreak([])).toBe(0)
  })

  it('calculates consecutive days', () => {
    const day = 24 * 60 * 60 * 1000
    const pulses = [0, 1, 2, 3, 4].map(d =>
      makePulse({ createdAt: new Date(Date.now() - d * day).toISOString() })
    )
    expect(calculateCheckInStreak(pulses)).toBe(5)
  })

  it('breaks on gap', () => {
    const day = 24 * 60 * 60 * 1000
    const pulses = [0, 1, 3].map(d =>
      makePulse({ createdAt: new Date(Date.now() - d * day).toISOString() })
    )
    expect(calculateCheckInStreak(pulses)).toBe(2)
  })
})

describe('showcase', () => {
  it('toggles showcase on and off', () => {
    const progress = [
      { achievementId: 'first_pulse' as const, userId: 'u1', unlockedAt: 'now', progress: 1, showcased: false },
    ]
    const on = toggleShowcase(progress, 'first_pulse')
    expect(on[0].showcased).toBe(true)
    const off = toggleShowcase(on, 'first_pulse')
    expect(off[0].showcased).toBe(false)
  })

  it('respects max showcased limit', () => {
    const ids = ['explorer_10', 'explorer_25', 'explorer_50', 'night_owl_5', 'night_owl_20'] as const
    const progress = ids.map((id, i) => ({
      achievementId: id,
      userId: 'u1',
      unlockedAt: 'now',
      progress: 10,
      showcased: i < 4,
    }))
    // 4 already showcased, trying to add 5th should be blocked
    const result = toggleShowcase(progress, 'night_owl_20', 4)
    expect(result.filter(p => p.showcased).length).toBe(4)
    expect(result.find(p => p.achievementId === 'night_owl_20')!.showcased).toBe(false)
  })
})

describe('weekly challenges', () => {
  it('creates a challenge', () => {
    const c = createWeeklyChallenge('Explore!', 'Visit 3 new spots', 'venue_count', 3, { xp: 50 })
    expect(c.target).toBe(3)
    expect(c.type).toBe('venue_count')
  })

  it('calculates progress for venue_count', () => {
    const c = createWeeklyChallenge('Explore', 'Visit 3 spots', 'venue_count', 3, { xp: 50 })
    const pulses = ['v1', 'v2', 'v3'].map(venueId =>
      makePulse({ userId: 'u1', venueId, createdAt: new Date().toISOString() })
    )
    const prog = calculateChallengeProgress(c, 'u1', pulses)
    expect(prog.completed).toBe(true)
    expect(prog.current).toBe(3)
  })

  it('calculates progress for energy_rating', () => {
    const c = createWeeklyChallenge('Electric!', 'Post 2 electric pulses', 'energy_rating', 2, { xp: 30 }, { energyRating: 'electric' })
    const pulses = [
      makePulse({ userId: 'u1', energyRating: 'electric' }),
      makePulse({ userId: 'u1', energyRating: 'chill' }),
      makePulse({ userId: 'u1', energyRating: 'electric' }),
    ]
    const prog = calculateChallengeProgress(c, 'u1', pulses)
    expect(prog.completed).toBe(true)
    expect(prog.current).toBe(2)
  })
})

describe('getAchievementById', () => {
  it('returns an achievement', () => {
    expect(getAchievementById('first_pulse')?.name).toBe('First Pulse')
  })

  it('returns undefined for unknown', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getAchievementById('nonexistent' as any)).toBeUndefined()
  })
})
