import type { Venue } from './types'

/**
 * Venue Quick Boost Engine
 *
 * Streamlined 3-tap promotion flow for venue owners to boost visibility.
 * Supports 6 boost types with configurable durations, analytics simulation,
 * and ROI tracking.
 */

// ─── Types ──────────────────────────────────────────────────────

export type BoostType = 'happy_hour' | 'live_music' | 'special_event' | 'last_call' | 'grand_opening' | 'featured'

export interface BoostConfig {
  type: BoostType
  label: string
  icon: string
  description: string
  durationOptions: number[]
  defaultDuration: number
  pinColor: string
  badgeText: string
}

export interface ActiveBoost {
  id: string
  venueId: string
  type: BoostType
  startTime: string
  endTime: string
  status: 'active' | 'scheduled' | 'expired'
  impressions: number
  taps: number
  conversions: number
}

export interface BoostAnalytics {
  totalImpressions: number
  totalTaps: number
  conversionRate: number
  comparedToAverage: number
  peakHour: number
}

// ─── Boost Configs ──────────────────────────────────────────────

export const BOOST_CONFIGS: Record<BoostType, BoostConfig> = {
  happy_hour: {
    type: 'happy_hour',
    label: 'Happy Hour',
    icon: 'BeerStein',
    description: 'Promote drink specials and attract the after-work crowd',
    durationOptions: [30, 60, 120, 240],
    defaultDuration: 120,
    pinColor: 'oklch(0.70 0.18 80)',
    badgeText: 'Happy Hour',
  },
  live_music: {
    type: 'live_music',
    label: 'Live Music',
    icon: 'MusicNotes',
    description: 'Highlight live performances and draw music lovers',
    durationOptions: [60, 120, 240],
    defaultDuration: 120,
    pinColor: 'oklch(0.65 0.25 300)',
    badgeText: 'Live Music',
  },
  special_event: {
    type: 'special_event',
    label: 'Special Event',
    icon: 'Confetti',
    description: 'Promote themed nights, parties, or special occasions',
    durationOptions: [60, 120, 240],
    defaultDuration: 240,
    pinColor: 'oklch(0.70 0.22 60)',
    badgeText: 'Event',
  },
  last_call: {
    type: 'last_call',
    label: 'Last Call',
    icon: 'Clock',
    description: 'Fill empty seats during the final hours of service',
    durationOptions: [30, 60],
    defaultDuration: 60,
    pinColor: 'oklch(0.60 0.20 25)',
    badgeText: 'Last Call',
  },
  grand_opening: {
    type: 'grand_opening',
    label: 'Grand Opening',
    icon: 'Sparkle',
    description: 'Maximum visibility for your venue launch or relaunch',
    durationOptions: [120, 240],
    defaultDuration: 240,
    pinColor: 'oklch(0.75 0.20 140)',
    badgeText: 'Grand Opening',
  },
  featured: {
    type: 'featured',
    label: 'Featured',
    icon: 'Star',
    description: 'Get premium placement in trending and discovery feeds',
    durationOptions: [30, 60, 120, 240],
    defaultDuration: 60,
    pinColor: 'oklch(0.65 0.28 340)',
    badgeText: 'Featured',
  },
}

// ─── Score Multipliers ──────────────────────────────────────────

const BOOST_MULTIPLIERS: Record<BoostType, number> = {
  happy_hour: 1.3,
  live_music: 1.5,
  special_event: 1.6,
  last_call: 1.2,
  grand_opening: 2.0,
  featured: 1.8,
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Create a new boost, either immediately or scheduled for a future time.
 */
export function createBoost(
  venueId: string,
  type: BoostType,
  duration: number,
  startTime?: string
): ActiveBoost {
  const start = startTime ? new Date(startTime) : new Date()
  const end = new Date(start.getTime() + duration * 60 * 1000)
  const now = new Date()

  let status: ActiveBoost['status'] = 'active'
  if (start.getTime() > now.getTime()) {
    status = 'scheduled'
  } else if (end.getTime() < now.getTime()) {
    status = 'expired'
  }

  return {
    id: `qboost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    type,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status,
    impressions: 0,
    taps: 0,
    conversions: 0,
  }
}

/**
 * Check whether a boost is currently active at the given time.
 */
export function isBoostActive(boost: ActiveBoost, currentTime?: Date): boolean {
  const now = currentTime ?? new Date()
  const start = new Date(boost.startTime)
  const end = new Date(boost.endTime)
  return start.getTime() <= now.getTime() && now.getTime() < end.getTime()
}

/**
 * Get all currently active boosts for a venue.
 */
export function getActiveBoosts(venueId: string, allBoosts: ActiveBoost[]): ActiveBoost[] {
  const now = new Date()
  return allBoosts.filter(
    b => b.venueId === venueId && isBoostActive(b, now) && b.status !== 'expired'
  )
}

/**
 * Calculate how much a boost increases the venue's visibility score.
 * Returns the boosted score (1.2x - 2.0x depending on type).
 */
export function calculateBoostScore(boost: ActiveBoost, baseScore: number): number {
  const multiplier = BOOST_MULTIPLIERS[boost.type]
  return Math.min(100, Math.round(baseScore * multiplier))
}

/**
 * Simulate realistic analytics for a boost based on venue popularity.
 */
export function simulateBoostAnalytics(boost: ActiveBoost, venuePulseScore: number): BoostAnalytics {
  const multiplier = BOOST_MULTIPLIERS[boost.type]
  const durationHours = (new Date(boost.endTime).getTime() - new Date(boost.startTime).getTime()) / (1000 * 60 * 60)

  // Base impressions scale with venue score and boost duration
  const baseImpressions = Math.round(venuePulseScore * 2.5 * durationHours)
  const totalImpressions = Math.round(baseImpressions * multiplier)

  // Tap-through rate varies by boost type
  const tapRates: Record<BoostType, number> = {
    happy_hour: 0.08,
    live_music: 0.12,
    special_event: 0.10,
    last_call: 0.06,
    grand_opening: 0.15,
    featured: 0.09,
  }
  const totalTaps = Math.round(totalImpressions * tapRates[boost.type])

  // Conversion rate (tap to actual visit)
  const conversionRate = totalTaps > 0
    ? Math.round((totalTaps * 0.25 / totalTaps) * 10000) / 100
    : 0

  // Compared to average (how much better than no boost)
  const comparedToAverage = Math.round((multiplier - 1) * 100)

  // Peak hour estimation
  const startHour = new Date(boost.startTime).getHours()
  const peakHour = boost.type === 'happy_hour'
    ? 18
    : boost.type === 'last_call'
      ? 23
      : Math.min(23, startHour + 2)

  return {
    totalImpressions,
    totalTaps,
    conversionRate,
    comparedToAverage,
    peakHour,
  }
}

/**
 * Calculate ROI for a boost given its analytics and cost.
 */
export function getBoostROI(analytics: BoostAnalytics, cost: number): number {
  if (cost <= 0) return 0
  // Assume average revenue per conversion visit is $35
  const estimatedRevenue = Math.round(analytics.totalTaps * 0.25) * 35
  return Math.round((estimatedRevenue / cost) * 100) / 100
}

/**
 * Check if a venue can create a new boost (max 2 concurrent boosts).
 */
export function canBoost(venueId: string, activeBoosts: ActiveBoost[]): boolean {
  const venueBoosts = getActiveBoosts(venueId, activeBoosts)
  return venueBoosts.length < 2
}

/**
 * Recommend the best boost type based on venue category, current time, and day.
 */
export function getRecommendedBoostType(
  venue: Venue,
  currentTime: Date,
  dayOfWeek: number
): BoostType {
  const hour = currentTime.getHours()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6

  // Late night — last call
  if (hour >= 22 || hour < 2) return 'last_call'

  // After-work hours — happy hour
  if (hour >= 16 && hour < 19) return 'happy_hour'

  // Music venue in evening
  if (venue.category?.toLowerCase().includes('music') && hour >= 19 && hour < 22) {
    return 'live_music'
  }

  // Weekend evenings — special events
  if (isWeekend && hour >= 19 && hour < 22) return 'special_event'

  // New venue (low score) — grand opening
  if (venue.pulseScore < 20) return 'grand_opening'

  // Default — featured
  return 'featured'
}

/**
 * Format a duration in minutes to a human-readable string.
 */
export function formatBoostDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (remaining === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  return `${hours} hour${hours > 1 ? 's' : ''} ${remaining} min`
}

/**
 * Estimate reach for a given boost type and duration.
 */
export function estimateReach(
  type: BoostType,
  durationMinutes: number,
  venuePulseScore: number
): number {
  const multiplier = BOOST_MULTIPLIERS[type]
  const durationHours = durationMinutes / 60
  return Math.round(venuePulseScore * 2.5 * durationHours * multiplier)
}

/**
 * Get remaining time in milliseconds for a boost.
 */
export function getBoostTimeRemaining(boost: ActiveBoost, currentTime?: Date): number {
  const now = currentTime ?? new Date()
  const end = new Date(boost.endTime)
  return Math.max(0, end.getTime() - now.getTime())
}
