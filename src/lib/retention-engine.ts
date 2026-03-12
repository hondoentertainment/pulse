import type { EnergyRating, Pulse, Venue, User } from './types'
import { ENERGY_CONFIG } from './types'

/**
 * Retention & Habit Loops Engine
 *
 * Daily drops, night recaps, streak tracking, weekly wrapups,
 * and milestone detection to drive re-engagement.
 */

// ── Daily Drop ──────────────────────────────────────────────

export interface DailyDrop {
  id: string
  venueId: string
  venueName: string
  category: string
  teaser: string
  revealAt: string
  isRevealed: boolean
}

const TEASER_TEMPLATES = [
  'This {category} spot is a hidden gem in the neighborhood...',
  'Locals swear by this {category} — have you been?',
  'A {category} that always delivers good energy...',
  'Tonight\'s pick: a {category} you don\'t want to miss...',
  'One of the best-kept secrets in the scene — a {category} worth checking out...',
  'Your next favorite {category} might be waiting here...',
  'Friends have been buzzing about this {category}...',
  'This {category} has been quietly trending — be the first to know...',
]

/**
 * Generate a curated daily venue drop with a teaser hint.
 * Picks a venue the user hasn't visited recently, weighted toward
 * higher pulse scores and matching preferred categories.
 */
export function generateDailyDrop(
  venues: Venue[],
  userPreferences: { favoriteCategories?: string[]; visitedVenueIds?: string[] },
  currentDate: string
): DailyDrop | null {
  if (venues.length === 0) return null

  const visitedSet = new Set(userPreferences.visitedVenueIds ?? [])
  const favCategories = new Set(userPreferences.favoriteCategories ?? [])

  // Score candidates: prefer unvisited, preferred category, higher pulse
  const scored = venues.map(v => {
    let score = v.pulseScore
    if (!visitedSet.has(v.id)) score += 30
    if (v.category && favCategories.has(v.category)) score += 20
    return { venue: v, score }
  })

  scored.sort((a, b) => b.score - a.score)

  // Deterministic daily pick using date as seed
  const dateHash = currentDate.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const topCandidates = scored.slice(0, Math.min(10, scored.length))
  const picked = topCandidates[dateHash % topCandidates.length]

  if (!picked) return null

  const venue = picked.venue
  const category = venue.category ?? 'spot'
  const template = TEASER_TEMPLATES[dateHash % TEASER_TEMPLATES.length]
  const teaser = template.replace('{category}', category)

  // Reveal at 7 PM on the current date
  const revealAt = new Date(currentDate + 'T19:00:00').toISOString()

  return {
    id: `drop-${currentDate}`,
    venueId: venue.id,
    venueName: venue.name,
    category,
    teaser,
    revealAt,
    isRevealed: new Date().toISOString() >= revealAt,
  }
}

// ── Night Recap ─────────────────────────────────────────────

export interface NightRecap {
  date: string
  venuesVisited: { id: string; name: string; peakEnergy: EnergyRating }[]
  friendsEncountered: string[]
  totalPulses: number
  topVibe: EnergyRating
  highlightMoment?: string
}

/**
 * Build a morning-after recap from the previous night's activity.
 * Covers roughly 6 PM to 6 AM window.
 */
export function generateNightRecap(
  userId: string,
  pulses: Pulse[],
  venues: Venue[],
  friends: User[],
  date: string
): NightRecap | null {
  const nightStart = new Date(date + 'T18:00:00')
  const nightEnd = new Date(nightStart.getTime() + 12 * 60 * 60 * 1000) // +12h → 6 AM next day

  const nightPulses = pulses.filter(p => {
    if (p.userId !== userId) return false
    const t = new Date(p.createdAt).getTime()
    return t >= nightStart.getTime() && t <= nightEnd.getTime()
  })

  if (nightPulses.length === 0) return null

  // Build venues visited with peak energy
  const venueMap = new Map(venues.map(v => [v.id, v]))
  const venueEnergyMap = new Map<string, EnergyRating>()
  const energyOrder: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

  for (const p of nightPulses) {
    const current = venueEnergyMap.get(p.venueId)
    if (!current || energyOrder.indexOf(p.energyRating) > energyOrder.indexOf(current)) {
      venueEnergyMap.set(p.venueId, p.energyRating)
    }
  }

  const venuesVisited = Array.from(venueEnergyMap.entries()).map(([venueId, peakEnergy]) => {
    const venue = venueMap.get(venueId)
    return { id: venueId, name: venue?.name ?? 'Unknown Venue', peakEnergy }
  })

  // Friends encountered: other users who pulsed at the same venues during the same window
  const userVenueIds = new Set(nightPulses.map(p => p.venueId))
  const friendIds = new Set(friends.map(f => f.id))
  const friendsAtVenues = pulses.filter(p => {
    if (p.userId === userId || !friendIds.has(p.userId)) return false
    if (!userVenueIds.has(p.venueId)) return false
    const t = new Date(p.createdAt).getTime()
    return t >= nightStart.getTime() && t <= nightEnd.getTime()
  })

  const friendsEncountered = Array.from(new Set(friendsAtVenues.map(p => {
    const friend = friends.find(f => f.id === p.userId)
    return friend?.username ?? p.userId
  })))

  // Top vibe: most common energy rating
  const energyCounts: Record<string, number> = {}
  for (const p of nightPulses) {
    energyCounts[p.energyRating] = (energyCounts[p.energyRating] ?? 0) + 1
  }
  const topVibe = (Object.entries(energyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'chill') as EnergyRating

  // Highlight moment: the pulse with the most reactions
  const topPulse = nightPulses.reduce((best, p) => {
    const reactions = p.reactions.fire.length + p.reactions.eyes.length +
      p.reactions.skull.length + p.reactions.lightning.length
    const bestReactions = best.reactions.fire.length + best.reactions.eyes.length +
      best.reactions.skull.length + best.reactions.lightning.length
    return reactions > bestReactions ? p : best
  }, nightPulses[0])

  const topReactions = topPulse.reactions.fire.length + topPulse.reactions.eyes.length +
    topPulse.reactions.skull.length + topPulse.reactions.lightning.length

  const highlightMoment = topReactions > 0
    ? `Your pulse at ${venueMap.get(topPulse.venueId)?.name ?? 'a venue'} got ${topReactions} reaction${topReactions > 1 ? 's' : ''} ${ENERGY_CONFIG[topPulse.energyRating].emoji}`
    : undefined

  return {
    date,
    venuesVisited,
    friendsEncountered,
    totalPulses: nightPulses.length,
    topVibe,
    highlightMoment,
  }
}

// ── Streak Tracking ─────────────────────────────────────────

export type StreakTier = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond'

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string
  tier: StreakTier
  freezesRemaining: number
  history: { date: string; active: boolean }[]
}

export const STREAK_TIER_THRESHOLDS: Record<StreakTier, number> = {
  none: 0,
  bronze: 3,
  silver: 7,
  gold: 30,
  diamond: 100,
}

/**
 * Determine streak tier from streak count.
 */
export function getStreakTier(streak: number): StreakTier {
  if (streak >= 100) return 'diamond'
  if (streak >= 30) return 'gold'
  if (streak >= 7) return 'silver'
  if (streak >= 3) return 'bronze'
  return 'none'
}

/**
 * Get the threshold for the next tier above the current one.
 */
export function getNextTierThreshold(tier: StreakTier): number | null {
  switch (tier) {
    case 'none': return STREAK_TIER_THRESHOLDS.bronze
    case 'bronze': return STREAK_TIER_THRESHOLDS.silver
    case 'silver': return STREAK_TIER_THRESHOLDS.gold
    case 'gold': return STREAK_TIER_THRESHOLDS.diamond
    case 'diamond': return null
  }
}

/**
 * Create a fresh streak data object.
 */
export function createEmptyStreak(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    tier: 'none',
    freezesRemaining: 1,
    history: [],
  }
}

/**
 * Update streak based on today's date. Call when the user performs
 * an activity (pulse / check-in).
 */
export function updateStreak(streakData: StreakData, today: string): StreakData {
  const data = { ...streakData, history: [...streakData.history] }

  if (data.lastActiveDate === today) {
    // Already active today — no change
    return data
  }

  const todayDate = new Date(today)
  const lastDate = data.lastActiveDate ? new Date(data.lastActiveDate) : null

  if (lastDate) {
    const diffMs = todayDate.getTime() - lastDate.getTime()
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

    if (diffDays === 1) {
      // Consecutive day — extend streak
      data.currentStreak += 1
    } else if (diffDays === 2 && data.freezesRemaining > 0) {
      // Missed one day — auto-apply freeze if available
      data.freezesRemaining -= 1
      data.currentStreak += 1
      // Add the missed day as frozen in history
      const missedDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]
      data.history.push({ date: missedDate, active: false })
    } else if (diffDays > 1) {
      // Streak broken
      data.currentStreak = 1
    }
  } else {
    // First ever activity
    data.currentStreak = 1
  }

  data.lastActiveDate = today
  data.longestStreak = Math.max(data.longestStreak, data.currentStreak)
  data.tier = getStreakTier(data.currentStreak)
  data.history.push({ date: today, active: true })

  // Keep only the last 90 days of history
  if (data.history.length > 90) {
    data.history = data.history.slice(-90)
  }

  return data
}

/**
 * Manually consume a streak freeze token.
 * Returns updated StreakData or null if no freezes remaining.
 */
export function useStreakFreeze(streakData: StreakData): StreakData | null {
  if (streakData.freezesRemaining <= 0) return null

  return {
    ...streakData,
    freezesRemaining: streakData.freezesRemaining - 1,
  }
}

// ── Weekly Wrapup ───────────────────────────────────────────

export interface WeeklyWrapup {
  weekStart: string
  weekEnd: string
  venuesExplored: number
  newDiscoveries: number
  topVibe: EnergyRating
  totalPulses: number
  comparisonToPrevious: { venuesDelta: number; pulsesDelta: number }
  topVenue?: string
}

/**
 * Generate end-of-week summary.
 */
export function generateWeeklyWrapup(
  userId: string,
  pulses: Pulse[],
  venues: Venue[],
  weekStart: string
): WeeklyWrapup | null {
  const start = new Date(weekStart)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000)

  const userPulses = pulses.filter(p => p.userId === userId)

  const thisWeekPulses = userPulses.filter(p => {
    const t = new Date(p.createdAt).getTime()
    return t >= start.getTime() && t < end.getTime()
  })

  if (thisWeekPulses.length === 0) return null

  const prevWeekPulses = userPulses.filter(p => {
    const t = new Date(p.createdAt).getTime()
    return t >= prevStart.getTime() && t < start.getTime()
  })

  // Venues this week
  const thisWeekVenueIds = new Set(thisWeekPulses.map(p => p.venueId))
  const prevWeekVenueIds = new Set(prevWeekPulses.map(p => p.venueId))

  // New discoveries: venues visited this week that weren't visited before this week
  const allPriorVenueIds = new Set(
    userPulses
      .filter(p => new Date(p.createdAt).getTime() < start.getTime())
      .map(p => p.venueId)
  )
  const newDiscoveries = Array.from(thisWeekVenueIds).filter(id => !allPriorVenueIds.has(id)).length

  // Top vibe
  const energyCounts: Record<string, number> = {}
  for (const p of thisWeekPulses) {
    energyCounts[p.energyRating] = (energyCounts[p.energyRating] ?? 0) + 1
  }
  const topVibe = (Object.entries(energyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'chill') as EnergyRating

  // Top venue by pulse count
  const venueCounts: Record<string, number> = {}
  for (const p of thisWeekPulses) {
    venueCounts[p.venueId] = (venueCounts[p.venueId] ?? 0) + 1
  }
  const topVenueId = Object.entries(venueCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const venueMap = new Map(venues.map(v => [v.id, v]))
  const topVenue = topVenueId ? venueMap.get(topVenueId)?.name : undefined

  return {
    weekStart,
    weekEnd: end.toISOString().split('T')[0],
    venuesExplored: thisWeekVenueIds.size,
    newDiscoveries,
    topVibe,
    totalPulses: thisWeekPulses.length,
    comparisonToPrevious: {
      venuesDelta: thisWeekVenueIds.size - prevWeekVenueIds.size,
      pulsesDelta: thisWeekPulses.length - prevWeekPulses.length,
    },
    topVenue,
  }
}

// ── Milestones ──────────────────────────────────────────────

export type MilestoneType =
  | '10th_checkin'
  | 'first_crew_night'
  | 'new_neighborhood'
  | '50_pulses'
  | 'week_streak'

export interface MilestoneConfig {
  type: MilestoneType
  title: string
  description: string
  icon: string
}

export const MILESTONE_CONFIGS: Record<MilestoneType, MilestoneConfig> = {
  '10th_checkin': {
    type: '10th_checkin',
    title: 'Double Digits!',
    description: 'You\'ve checked in 10 times — you\'re becoming a regular.',
    icon: 'trophy',
  },
  'first_crew_night': {
    type: 'first_crew_night',
    title: 'Crew Night!',
    description: 'Your first night out with your crew. The squad is official.',
    icon: 'users',
  },
  'new_neighborhood': {
    type: 'new_neighborhood',
    title: 'New Territory!',
    description: 'You explored a new neighborhood for the first time.',
    icon: 'map',
  },
  '50_pulses': {
    type: '50_pulses',
    title: 'Pulse Legend!',
    description: '50 pulses dropped — the city knows your vibe.',
    icon: 'lightning',
  },
  'week_streak': {
    type: 'week_streak',
    title: 'Week Warrior!',
    description: '7 days in a row — you\'re on fire!',
    icon: 'fire',
  },
}

/**
 * Check which milestones were just achieved.
 * Returns only newly triggered milestones (call after each activity).
 */
export function checkMilestones(
  userId: string,
  pulses: Pulse[],
  crews?: { id: string; members: string[] }[],
  streakData?: StreakData
): MilestoneType[] {
  const achieved: MilestoneType[] = []
  const userPulses = pulses.filter(p => p.userId === userId)

  // 10th check-in: exactly 10 unique venues
  const uniqueVenues = new Set(userPulses.map(p => p.venueId))
  if (uniqueVenues.size === 10) {
    achieved.push('10th_checkin')
  }

  // 50 pulses: exactly at 50
  if (userPulses.length === 50) {
    achieved.push('50_pulses')
  }

  // First crew night: user is in a crew and 2+ crew members pulsed at the same venue on the same night
  if (crews && crews.length > 0) {
    for (const crew of crews) {
      if (!crew.members.includes(userId)) continue
      const otherMembers = crew.members.filter(m => m !== userId)

      // Check if any other crew member pulsed at the same venue within 4 hours
      for (const myPulse of userPulses) {
        const myTime = new Date(myPulse.createdAt).getTime()
        const crewMatesAtVenue = pulses.filter(p =>
          otherMembers.includes(p.userId) &&
          p.venueId === myPulse.venueId &&
          Math.abs(new Date(p.createdAt).getTime() - myTime) < 4 * 60 * 60 * 1000
        )
        if (crewMatesAtVenue.length > 0) {
          achieved.push('first_crew_night')
          break
        }
      }
      if (achieved.includes('first_crew_night')) break
    }
  }

  // New neighborhood: user pulsed at a venue in a new city/area
  // Simplified: check if latest pulse is in a city not seen before
  if (userPulses.length >= 2) {
    const sortedPulses = [...userPulses].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const latestVenueId = sortedPulses[0].venueId
    const priorVenueIds = new Set(sortedPulses.slice(1).map(p => p.venueId))
    if (!priorVenueIds.has(latestVenueId)) {
      // New venue — could be new neighborhood
      // In production this would check geographic clustering;
      // here we trigger if it's the user's 5th unique venue
      if (uniqueVenues.size === 5) {
        achieved.push('new_neighborhood')
      }
    }
  }

  // Week streak
  if (streakData && streakData.currentStreak === 7) {
    achieved.push('week_streak')
  }

  return achieved
}
