import type { Pulse, User } from './types'

/**
 * Streak-Powered Check-In Rewards Engine
 *
 * Tracks multiple streak types, calculates milestones,
 * XP multipliers, friend leaderboards, and at-risk warnings.
 */

export type StreakType =
  | 'weekly_checkin'
  | 'weekend_warrior'
  | 'explorer'
  | 'social_butterfly'
  | 'early_bird'
  | 'night_owl'
  | 'venue_loyal'

export interface Streak {
  userId: string
  type: StreakType
  currentCount: number
  longestCount: number
  lastActivity: string
  isActive: boolean
  expiresAt: string
}

export interface StreakReward {
  streakType: StreakType
  milestone: number
  title: string
  description: string
  icon: string
  xpBonus: number
}

export interface LeaderboardEntry {
  user: User
  streakType: StreakType
  count: number
  rank: number
  isCurrentUser: boolean
}

export interface StreakDefinition {
  type: StreakType
  label: string
  description: string
  icon: string
  /** How many days before the streak breaks */
  expiryDays: number
  rewards: StreakReward[]
}

export const MILESTONES = [3, 5, 10, 25, 50, 100] as const

export const STREAK_DEFINITIONS: StreakDefinition[] = [
  {
    type: 'weekly_checkin',
    label: 'Weekly Regular',
    description: 'Check in at least once every week',
    icon: '📅',
    expiryDays: 7,
    rewards: MILESTONES.map(m => ({
      streakType: 'weekly_checkin' as StreakType,
      milestone: m,
      title: m >= 50 ? 'Legendary Regular' : m >= 25 ? 'Dedicated Regular' : m >= 10 ? 'Committed Regular' : `Weekly Regular ${m}`,
      description: `${m} consecutive weekly check-ins`,
      icon: m >= 25 ? '👑' : m >= 10 ? '⭐' : '📅',
      xpBonus: m * 10,
    })),
  },
  {
    type: 'weekend_warrior',
    label: 'Weekend Warrior',
    description: 'Check in every weekend (Fri-Sun)',
    icon: '🎉',
    expiryDays: 9, // From Sunday to next Friday = generous window
    rewards: MILESTONES.map(m => ({
      streakType: 'weekend_warrior' as StreakType,
      milestone: m,
      title: m >= 50 ? 'Weekend Legend' : m >= 25 ? 'Weekend Champion' : m >= 10 ? 'Weekend Veteran' : `Weekend Warrior ${m}`,
      description: `${m} consecutive weekends out`,
      icon: m >= 25 ? '🏆' : m >= 10 ? '🎊' : '🎉',
      xpBonus: m * 15,
    })),
  },
  {
    type: 'explorer',
    label: 'Explorer',
    description: 'Visit a new venue each streak period',
    icon: '🗺️',
    expiryDays: 7,
    rewards: MILESTONES.map(m => ({
      streakType: 'explorer' as StreakType,
      milestone: m,
      title: m >= 50 ? 'Trailblazer Supreme' : m >= 25 ? 'Master Explorer' : m >= 10 ? 'Seasoned Explorer' : `Explorer ${m}`,
      description: `Discovered ${m} new venues in a row`,
      icon: m >= 25 ? '🏔️' : m >= 10 ? '🧭' : '🗺️',
      xpBonus: m * 12,
    })),
  },
  {
    type: 'social_butterfly',
    label: 'Social Butterfly',
    description: 'Check in at venues where friends are present',
    icon: '🦋',
    expiryDays: 7,
    rewards: MILESTONES.map(m => ({
      streakType: 'social_butterfly' as StreakType,
      milestone: m,
      title: m >= 50 ? 'Social Monarch' : m >= 25 ? 'Social Star' : m >= 10 ? 'Social Regular' : `Social Butterfly ${m}`,
      description: `${m} consecutive social check-ins`,
      icon: m >= 25 ? '👑' : m >= 10 ? '🌟' : '🦋',
      xpBonus: m * 10,
    })),
  },
  {
    type: 'early_bird',
    label: 'Early Bird',
    description: 'Check in before 6 PM',
    icon: '🌅',
    expiryDays: 7,
    rewards: MILESTONES.map(m => ({
      streakType: 'early_bird' as StreakType,
      milestone: m,
      title: m >= 50 ? 'Dawn Patrol Legend' : m >= 25 ? 'Early Riser Pro' : m >= 10 ? 'Morning Person' : `Early Bird ${m}`,
      description: `${m} consecutive early check-ins`,
      icon: m >= 25 ? '☀️' : m >= 10 ? '🌤️' : '🌅',
      xpBonus: m * 8,
    })),
  },
  {
    type: 'night_owl',
    label: 'Night Owl',
    description: 'Check in after midnight',
    icon: '🦉',
    expiryDays: 7,
    rewards: MILESTONES.map(m => ({
      streakType: 'night_owl' as StreakType,
      milestone: m,
      title: m >= 50 ? 'Creature of Darkness' : m >= 25 ? 'Nocturnal Master' : m >= 10 ? 'Night Crawler' : `Night Owl ${m}`,
      description: `${m} consecutive late-night check-ins`,
      icon: m >= 25 ? '🌙' : m >= 10 ? '🌃' : '🦉',
      xpBonus: m * 12,
    })),
  },
  {
    type: 'venue_loyal',
    label: 'Venue Loyal',
    description: 'Return to the same venue repeatedly',
    icon: '🏠',
    expiryDays: 14,
    rewards: MILESTONES.map(m => ({
      streakType: 'venue_loyal' as StreakType,
      milestone: m,
      title: m >= 50 ? 'VIP Legend' : m >= 25 ? 'VIP Elite' : m >= 10 ? 'Loyal Patron' : `Venue Loyal ${m}`,
      description: `${m} consecutive visits to your spot`,
      icon: m >= 25 ? '👑' : m >= 10 ? '🏅' : '🏠',
      xpBonus: m * 10,
    })),
  },
]

/**
 * Check the streak progress for all streak types given a user's check-in history.
 */
export function checkStreakProgress(
  userId: string,
  checkins: Pulse[],
  currentTime: Date = new Date()
): Streak[] {
  const userCheckins = checkins
    .filter(p => p.userId === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return STREAK_DEFINITIONS.map(def => {
    const streak = evaluateStreakType(def, userCheckins, currentTime)
    return {
      userId,
      type: def.type,
      currentCount: streak.currentCount,
      longestCount: streak.longestCount,
      lastActivity: streak.lastActivity,
      isActive: streak.isActive,
      expiresAt: streak.expiresAt,
    }
  })
}

interface StreakEvalResult {
  currentCount: number
  longestCount: number
  lastActivity: string
  isActive: boolean
  expiresAt: string
}

function evaluateStreakType(
  def: StreakDefinition,
  checkins: Pulse[],
  currentTime: Date
): StreakEvalResult {
  const empty: StreakEvalResult = {
    currentCount: 0,
    longestCount: 0,
    lastActivity: '',
    isActive: false,
    expiresAt: '',
  }

  if (checkins.length === 0) return empty

  const qualifying = filterQualifyingCheckins(def.type, checkins)
  if (qualifying.length === 0) return empty

  // Group by streak periods
  const periods = groupIntoPeriods(def.type, qualifying)
  if (periods.length === 0) return empty

  // Calculate consecutive period streaks
  const { currentCount, longestCount } = calculateConsecutivePeriods(def, periods, currentTime)
  const lastActivity = qualifying[qualifying.length - 1].createdAt
  const expiresAt = calculateStreakExpiry(def.type, lastActivity)
  const isActive = currentCount > 0 && new Date(expiresAt).getTime() > currentTime.getTime()

  return {
    currentCount: isActive ? currentCount : 0,
    longestCount,
    lastActivity,
    isActive,
    expiresAt: isActive ? expiresAt : '',
  }
}

function filterQualifyingCheckins(type: StreakType, checkins: Pulse[]): Pulse[] {
  return checkins.filter(p => {
    const hour = new Date(p.createdAt).getHours()
    const day = new Date(p.createdAt).getDay()
    switch (type) {
      case 'weekly_checkin':
        return true
      case 'weekend_warrior':
        return day === 0 || day === 5 || day === 6 // Fri, Sat, Sun
      case 'explorer':
        return true // uniqueness checked in period grouping
      case 'social_butterfly':
        return true // social context checked externally; here we count all
      case 'early_bird':
        return hour < 18
      case 'night_owl':
        return hour >= 0 && hour < 4
      case 'venue_loyal':
        return true
    }
  })
}

/** Get the period key for a given check-in date and streak type. */
function getPeriodKey(type: StreakType, date: Date): string {
  switch (type) {
    case 'weekend_warrior': {
      // Period = the week's weekend (keyed by the ISO week)
      const d = new Date(date)
      const dayNum = d.getDay()
      // Roll back to Friday of this weekend
      const friday = new Date(d)
      if (dayNum === 0) friday.setDate(d.getDate() - 2) // Sun -> Fri
      else if (dayNum === 6) friday.setDate(d.getDate() - 1) // Sat -> Fri
      // else it's Friday
      return friday.toISOString().split('T')[0]
    }
    case 'venue_loyal': {
      // Period = a 2-week window
      const epoch = new Date('2024-01-01').getTime()
      const weekNum = Math.floor((date.getTime() - epoch) / (14 * 24 * 60 * 60 * 1000))
      return `biweek-${weekNum}`
    }
    default: {
      // Weekly period keyed by ISO week start (Monday)
      const d = new Date(date)
      const dayNum = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((dayNum + 6) % 7))
      return monday.toISOString().split('T')[0]
    }
  }
}

function groupIntoPeriods(type: StreakType, checkins: Pulse[]): string[] {
  const periodSet = new Set<string>()

  if (type === 'explorer') {
    // For explorer, each period must have a NEW venue
    const seenVenues = new Set<string>()
    for (const p of checkins) {
      if (!seenVenues.has(p.venueId)) {
        seenVenues.add(p.venueId)
        periodSet.add(getPeriodKey(type, new Date(p.createdAt)))
      }
    }
  } else if (type === 'venue_loyal') {
    // Find the most-visited venue and count its periods
    const venueCounts: Record<string, Set<string>> = {}
    for (const p of checkins) {
      if (!venueCounts[p.venueId]) venueCounts[p.venueId] = new Set()
      venueCounts[p.venueId].add(getPeriodKey(type, new Date(p.createdAt)))
    }
    let maxPeriods: Set<string> = new Set()
    for (const periods of Object.values(venueCounts)) {
      if (periods.size > maxPeriods.size) maxPeriods = periods
    }
    return Array.from(maxPeriods).sort()
  } else {
    for (const p of checkins) {
      periodSet.add(getPeriodKey(type, new Date(p.createdAt)))
    }
  }

  return Array.from(periodSet).sort()
}

function calculateConsecutivePeriods(
  def: StreakDefinition,
  periods: string[],
  currentTime: Date
): { currentCount: number; longestCount: number } {
  if (periods.length === 0) return { currentCount: 0, longestCount: 0 }

  // For simplicity, we check if periods are consecutive by checking gaps
  const periodMs = def.expiryDays * 24 * 60 * 60 * 1000

  let currentCount = 1
  let longestCount = 1
  let tempCount = 1

  for (let i = 1; i < periods.length; i++) {
    const prevDate = new Date(periods[i - 1])
    const currDate = new Date(periods[i])
    const gap = currDate.getTime() - prevDate.getTime()

    if (gap <= periodMs) {
      tempCount++
    } else {
      tempCount = 1
    }
    longestCount = Math.max(longestCount, tempCount)
  }

  // Current count = streak from the latest period backward
  currentCount = 1
  for (let i = periods.length - 1; i > 0; i--) {
    const currDate = new Date(periods[i])
    const prevDate = new Date(periods[i - 1])
    const gap = currDate.getTime() - prevDate.getTime()

    if (gap <= periodMs) {
      currentCount++
    } else {
      break
    }
  }

  // Check if the latest period is still active (not expired)
  const lastPeriodDate = new Date(periods[periods.length - 1])
  const timeSinceLast = currentTime.getTime() - lastPeriodDate.getTime()
  if (timeSinceLast > periodMs) {
    currentCount = 0
  }

  longestCount = Math.max(longestCount, currentCount)

  return { currentCount, longestCount }
}

/**
 * Calculate when a streak will expire based on streak type and last activity.
 */
export function calculateStreakExpiry(streakType: StreakType, lastActivity: string): string {
  if (!lastActivity) return ''
  const lastDate = new Date(lastActivity)
  const def = STREAK_DEFINITIONS.find(d => d.type === streakType)
  if (!def) return ''

  const expiryDate = new Date(lastDate.getTime() + def.expiryDays * 24 * 60 * 60 * 1000)
  return expiryDate.toISOString()
}

/**
 * Get the next milestone threshold for a streak.
 */
export function getNextMilestone(streak: Streak): number | null {
  for (const m of MILESTONES) {
    if (streak.currentCount < m) return m
  }
  return null
}

/**
 * Get progress toward the next milestone as a 0.0-1.0 value.
 */
export function getProgressToNextMilestone(streak: Streak): number {
  const next = getNextMilestone(streak)
  if (next === null) return 1.0
  if (streak.currentCount === 0) return 0.0

  // Find the previous milestone
  const prevMilestones = MILESTONES.filter(m => m < next)
  const prev = prevMilestones.length > 0 ? prevMilestones[prevMilestones.length - 1] : 0

  return (streak.currentCount - prev) / (next - prev)
}

/**
 * Generate a notification message for reaching a streak milestone.
 */
export function generateStreakNotification(streak: Streak, milestone: number): string {
  const def = STREAK_DEFINITIONS.find(d => d.type === streak.type)
  if (!def) return ''

  const reward = def.rewards.find(r => r.milestone === milestone)
  const title = reward?.title ?? `${def.label} ${milestone}`

  return `You've hit ${milestone} ${def.label.toLowerCase()} streak! ${title} unlocked!`
}

/**
 * Build a friend leaderboard for a specific streak type.
 */
export function buildFriendLeaderboard(
  userId: string,
  friends: User[],
  allStreaks: Streak[],
  streakType: StreakType
): LeaderboardEntry[] {
  const relevantUsers = [
    ...friends,
    // We need the current user too, so we create a placeholder if not in friends
  ]

  // Build entries for each friend + current user
  const entries: { user: User; count: number; isCurrentUser: boolean }[] = []

  for (const friend of relevantUsers) {
    const streak = allStreaks.find(s => s.userId === friend.id && s.type === streakType)
    entries.push({
      user: friend,
      count: streak?.currentCount ?? 0,
      isCurrentUser: friend.id === userId,
    })
  }

  // Add current user if not already in friends list
  if (!entries.some(e => e.isCurrentUser)) {
    const userStreak = allStreaks.find(s => s.userId === userId && s.type === streakType)
    entries.push({
      user: { id: userId, username: 'You', friends: [], createdAt: '' },
      count: userStreak?.currentCount ?? 0,
      isCurrentUser: true,
    })
  }

  // Sort by count descending, then by username for ties
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.user.username.localeCompare(b.user.username)
  })

  // Assign ranks (tied users get the same rank)
  let currentRank = 1
  return entries.map((entry, i) => {
    if (i > 0 && entries[i - 1].count > entry.count) {
      currentRank = i + 1
    }
    return {
      user: entry.user,
      streakType,
      count: entry.count,
      rank: currentRank,
      isCurrentUser: entry.isCurrentUser,
    }
  })
}

/**
 * Calculate XP multiplier based on number of active streaks.
 * 0 streaks = 1x, 1-2 = 1.5x, 3-4 = 2x, 5+ = 3x
 */
export function getStreakMultiplier(activeStreaks: Streak[]): number {
  const count = activeStreaks.filter(s => s.isActive).length
  if (count >= 5) return 3.0
  if (count >= 3) return 2.0
  if (count >= 1) return 1.5
  return 1.0
}

/**
 * Check if a streak is at risk of expiring (within 24 hours).
 */
export function isAtRisk(streak: Streak): boolean {
  if (!streak.isActive || !streak.expiresAt) return false
  const expiresAt = new Date(streak.expiresAt).getTime()
  const now = Date.now()
  const twentyFourHours = 24 * 60 * 60 * 1000
  return expiresAt - now <= twentyFourHours && expiresAt > now
}

/**
 * Calculate total XP from achieved milestones across all streaks.
 */
export function calculateTotalXP(streaks: Streak[]): number {
  let totalXP = 0

  for (const streak of streaks) {
    const def = STREAK_DEFINITIONS.find(d => d.type === streak.type)
    if (!def) continue

    const count = Math.max(streak.currentCount, streak.longestCount)
    for (const reward of def.rewards) {
      if (count >= reward.milestone) {
        totalXP += reward.xpBonus
      }
    }
  }

  return totalXP
}

/**
 * Get all milestones that a streak has achieved.
 */
export function getAchievedMilestones(streak: Streak): StreakReward[] {
  const def = STREAK_DEFINITIONS.find(d => d.type === streak.type)
  if (!def) return []

  const count = Math.max(streak.currentCount, streak.longestCount)
  return def.rewards.filter(r => count >= r.milestone)
}
