import type { Pulse, User, EnergyRating } from './types'

/**
 * Venue Challenges & Achievements Engine
 *
 * Weekly challenges, achievement system, seasonal achievements,
 * and profile showcase.
 */

export type AchievementId =
  | 'explorer_10'
  | 'explorer_25'
  | 'explorer_50'
  | 'night_owl_5'
  | 'night_owl_20'
  | 'trendsetter_3'
  | 'trendsetter_10'
  | 'social_butterfly'
  | 'regular_5'
  | 'regular_20'
  | 'first_pulse'
  | 'energy_master'
  | 'crew_starter'
  | 'streak_7'
  | 'streak_30'

export interface Achievement {
  id: AchievementId
  name: string
  description: string
  icon: string
  category: 'exploration' | 'nightlife' | 'social' | 'consistency' | 'special'
  tier: 'bronze' | 'silver' | 'gold'
  requirement: number
  seasonal?: boolean
}

export interface UserAchievement {
  achievementId: AchievementId
  userId: string
  unlockedAt: string
  progress: number
  showcased: boolean
}

export interface WeeklyChallenge {
  id: string
  title: string
  description: string
  type: 'venue_count' | 'category_visit' | 'energy_rating' | 'social' | 'streak'
  target: number
  category?: string
  energyRating?: EnergyRating
  startDate: string
  endDate: string
  reward: { xp: number; badge?: string }
}

export interface UserChallengeProgress {
  challengeId: string
  userId: string
  current: number
  target: number
  completed: boolean
  completedAt?: string
}

export const ACHIEVEMENTS: Achievement[] = [
  // Exploration
  { id: 'explorer_10', name: 'Explorer', description: 'Check into 10 unique venues', icon: '🗺️', category: 'exploration', tier: 'bronze', requirement: 10 },
  { id: 'explorer_25', name: 'Adventurer', description: 'Check into 25 unique venues', icon: '🧭', category: 'exploration', tier: 'silver', requirement: 25 },
  { id: 'explorer_50', name: 'Trailblazer', description: 'Check into 50 unique venues', icon: '🏔️', category: 'exploration', tier: 'gold', requirement: 50 },

  // Nightlife
  { id: 'night_owl_5', name: 'Night Owl', description: 'Post 5 pulses after midnight', icon: '🦉', category: 'nightlife', tier: 'bronze', requirement: 5 },
  { id: 'night_owl_20', name: 'Creature of the Night', description: 'Post 20 pulses after midnight', icon: '🌙', category: 'nightlife', tier: 'silver', requirement: 20 },

  // Social
  { id: 'trendsetter_3', name: 'Trendsetter', description: 'First pulse at 3 venues that later surged', icon: '📈', category: 'social', tier: 'bronze', requirement: 3 },
  { id: 'trendsetter_10', name: 'Tastemaker', description: 'First pulse at 10 venues that later surged', icon: '🌟', category: 'social', tier: 'gold', requirement: 10 },
  { id: 'social_butterfly', name: 'Social Butterfly', description: 'Add 10 friends', icon: '🦋', category: 'social', tier: 'bronze', requirement: 10 },

  // Consistency
  { id: 'regular_5', name: 'Regular', description: 'Visit the same venue 5 times', icon: '🏠', category: 'consistency', tier: 'bronze', requirement: 5 },
  { id: 'regular_20', name: 'VIP', description: 'Visit the same venue 20 times', icon: '👑', category: 'consistency', tier: 'gold', requirement: 20 },
  { id: 'first_pulse', name: 'First Pulse', description: 'Post your first pulse', icon: '💫', category: 'special', tier: 'bronze', requirement: 1 },
  { id: 'energy_master', name: 'Energy Master', description: 'Post a pulse at every energy level', icon: '🎯', category: 'special', tier: 'silver', requirement: 4 },
  { id: 'crew_starter', name: 'Crew Starter', description: 'Create your first crew', icon: '👯', category: 'social', tier: 'bronze', requirement: 1 },
  { id: 'streak_7', name: 'On a Roll', description: '7-day check-in streak', icon: '🔥', category: 'consistency', tier: 'silver', requirement: 7 },
  { id: 'streak_30', name: 'Unstoppable', description: '30-day check-in streak', icon: '💎', category: 'consistency', tier: 'gold', requirement: 30 },
]

/**
 * Calculate achievement progress for a user.
 */
export function calculateAchievementProgress(
  user: User,
  pulses: Pulse[],
  allPulses: Pulse[]
): UserAchievement[] {
  const userPulses = pulses.filter(p => p.userId === user.id)
  const results: UserAchievement[] = []
  const now = new Date().toISOString()

  // Unique venues visited
  const uniqueVenues = new Set(userPulses.map(p => p.venueId)).size
  for (const achId of ['explorer_10', 'explorer_25', 'explorer_50'] as AchievementId[]) {
    const ach = ACHIEVEMENTS.find(a => a.id === achId)!
    results.push({
      achievementId: achId,
      userId: user.id,
      unlockedAt: uniqueVenues >= ach.requirement ? now : '',
      progress: uniqueVenues,
      showcased: false,
    })
  }

  // Night owl: pulses after midnight (0-4 AM)
  const nightPulses = userPulses.filter(p => {
    const hour = new Date(p.createdAt).getHours()
    return hour >= 0 && hour < 4
  }).length
  for (const achId of ['night_owl_5', 'night_owl_20'] as AchievementId[]) {
    const ach = ACHIEVEMENTS.find(a => a.id === achId)!
    results.push({
      achievementId: achId,
      userId: user.id,
      unlockedAt: nightPulses >= ach.requirement ? now : '',
      progress: nightPulses,
      showcased: false,
    })
  }

  // Trendsetter: first pulse at venues that later surged
  const trendsetterCount = countTrendsetterVenues(user.id, userPulses, allPulses)
  for (const achId of ['trendsetter_3', 'trendsetter_10'] as AchievementId[]) {
    const ach = ACHIEVEMENTS.find(a => a.id === achId)!
    results.push({
      achievementId: achId,
      userId: user.id,
      unlockedAt: trendsetterCount >= ach.requirement ? now : '',
      progress: trendsetterCount,
      showcased: false,
    })
  }

  // Social butterfly
  const friendCount = user.friends.length
  results.push({
    achievementId: 'social_butterfly',
    userId: user.id,
    unlockedAt: friendCount >= 10 ? now : '',
    progress: friendCount,
    showcased: false,
  })

  // Regular: most-visited venue
  const venueCounts: Record<string, number> = {}
  for (const p of userPulses) {
    venueCounts[p.venueId] = (venueCounts[p.venueId] ?? 0) + 1
  }
  const maxVisits = Math.max(0, ...Object.values(venueCounts))
  for (const achId of ['regular_5', 'regular_20'] as AchievementId[]) {
    const ach = ACHIEVEMENTS.find(a => a.id === achId)!
    results.push({
      achievementId: achId,
      userId: user.id,
      unlockedAt: maxVisits >= ach.requirement ? now : '',
      progress: maxVisits,
      showcased: false,
    })
  }

  // First pulse
  results.push({
    achievementId: 'first_pulse',
    userId: user.id,
    unlockedAt: userPulses.length >= 1 ? now : '',
    progress: Math.min(userPulses.length, 1),
    showcased: false,
  })

  // Energy master: used all 4 energy levels
  const usedEnergies = new Set(userPulses.map(p => p.energyRating)).size
  results.push({
    achievementId: 'energy_master',
    userId: user.id,
    unlockedAt: usedEnergies >= 4 ? now : '',
    progress: usedEnergies,
    showcased: false,
  })

  // Crew starter (placeholder — checked externally)
  results.push({
    achievementId: 'crew_starter',
    userId: user.id,
    unlockedAt: '',
    progress: 0,
    showcased: false,
  })

  // Streak calculations
  const streak = calculateCheckInStreak(userPulses)
  for (const achId of ['streak_7', 'streak_30'] as AchievementId[]) {
    const ach = ACHIEVEMENTS.find(a => a.id === achId)!
    results.push({
      achievementId: achId,
      userId: user.id,
      unlockedAt: streak >= ach.requirement ? now : '',
      progress: streak,
      showcased: false,
    })
  }

  return results
}

/**
 * Count venues where user was the first to pulse AND venue later surged (score > 60).
 */
function countTrendsetterVenues(userId: string, userPulses: Pulse[], allPulses: Pulse[]): number {
  let count = 0
  const venueFirstPulse = new Map<string, Pulse>()

  // Find the first pulse at each venue (across all users)
  for (const p of allPulses) {
    const existing = venueFirstPulse.get(p.venueId)
    if (!existing || new Date(p.createdAt) < new Date(existing.createdAt)) {
      venueFirstPulse.set(p.venueId, p)
    }
  }

  // Check where user was first AND venue later got busy
  for (const [venueId, firstPulse] of venueFirstPulse) {
    if (firstPulse.userId !== userId) continue
    const laterPulses = allPulses.filter(
      p => p.venueId === venueId && new Date(p.createdAt) > new Date(firstPulse.createdAt)
    )
    // "Surged" = got at least 3 pulses rated buzzing or electric
    const surgeCount = laterPulses.filter(
      p => p.energyRating === 'buzzing' || p.energyRating === 'electric'
    ).length
    if (surgeCount >= 3) count++
  }

  return count
}

/**
 * Calculate consecutive-day check-in streak.
 */
export function calculateCheckInStreak(pulses: Pulse[]): number {
  if (pulses.length === 0) return 0

  const days = new Set(
    pulses.map(p => new Date(p.createdAt).toISOString().split('T')[0])
  )
  const sortedDays = Array.from(days).sort().reverse()

  let streak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const curr = new Date(sortedDays[i])
    const prev = new Date(sortedDays[i - 1])
    const diff = (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000)
    if (Math.round(diff) === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/**
 * Get unlocked achievements.
 */
export function getUnlockedAchievements(progress: UserAchievement[]): UserAchievement[] {
  return progress.filter(p => p.unlockedAt !== '')
}

/**
 * Get showcased achievements for a profile.
 */
export function getShowcasedAchievements(progress: UserAchievement[]): UserAchievement[] {
  return progress.filter(p => p.showcased && p.unlockedAt !== '')
}

/**
 * Toggle showcase for an achievement.
 */
export function toggleShowcase(
  progress: UserAchievement[],
  achievementId: AchievementId,
  maxShowcased: number = 4
): UserAchievement[] {
  const item = progress.find(p => p.achievementId === achievementId)
  if (!item || !item.unlockedAt) return progress

  if (item.showcased) {
    return progress.map(p =>
      p.achievementId === achievementId ? { ...p, showcased: false } : p
    )
  }

  const currentShowcased = progress.filter(p => p.showcased).length
  if (currentShowcased >= maxShowcased) return progress

  return progress.map(p =>
    p.achievementId === achievementId ? { ...p, showcased: true } : p
  )
}

/**
 * Create a weekly challenge.
 */
export function createWeeklyChallenge(
  title: string,
  description: string,
  type: WeeklyChallenge['type'],
  target: number,
  reward: WeeklyChallenge['reward'],
  options?: { category?: string; energyRating?: EnergyRating }
): WeeklyChallenge {
  const now = new Date()
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    id: `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    type,
    target,
    category: options?.category,
    energyRating: options?.energyRating,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    reward,
  }
}

/**
 * Calculate progress for a weekly challenge.
 */
export function calculateChallengeProgress(
  challenge: WeeklyChallenge,
  userId: string,
  pulses: Pulse[]
): UserChallengeProgress {
  const start = new Date(challenge.startDate).getTime()
  const end = new Date(challenge.endDate).getTime()
  const relevantPulses = pulses.filter(p => {
    const t = new Date(p.createdAt).getTime()
    return p.userId === userId && t >= start && t <= end
  })

  let current = 0

  switch (challenge.type) {
    case 'venue_count': {
      const uniqueVenues = new Set(relevantPulses.map(p => p.venueId))
      current = uniqueVenues.size
      break
    }
    case 'energy_rating': {
      current = relevantPulses.filter(p => p.energyRating === challenge.energyRating).length
      break
    }
    case 'streak': {
      current = calculateCheckInStreak(relevantPulses)
      break
    }
    default:
      current = relevantPulses.length
  }

  return {
    challengeId: challenge.id,
    userId,
    current: Math.min(current, challenge.target),
    target: challenge.target,
    completed: current >= challenge.target,
    completedAt: current >= challenge.target ? new Date().toISOString() : undefined,
  }
}

/**
 * Get achievement metadata by id.
 */
export function getAchievementById(id: AchievementId): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}
