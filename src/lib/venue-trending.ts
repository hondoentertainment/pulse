import { Venue, Pulse, VenueAnalytics } from './types'

export const TRENDING_THRESHOLDS = {
  MIN_UNIQUE_USERS: 3,
  MIN_PULSES_15MIN: 2,
  RAPID_SCORE_INCREASE: 20,
  TIME_WINDOW_MINUTES: 15,
  GAINING_ENERGY_THRESHOLD: 40,
  PRE_TRENDING_CONVERSION_HOURS: 24,
}

export interface TrendingSection {
  title: string
  venues: Venue[]
  description: string
  updatedAt: string
}

const ENERGY_VALUES = { dead: 0, chill: 25, buzzing: 50, electric: 100 } as const

interface VenuePulseStats {
  all: Pulse[]
  recent: Pulse[]
  previous: Pulse[]
  uniqueUsers: Set<string>
  recentUniqueUsers: Set<string>
  velocity: number
}

function createEmptyStats(): VenuePulseStats {
  return {
    all: [],
    recent: [],
    previous: [],
    uniqueUsers: new Set(),
    recentUniqueUsers: new Set(),
    velocity: 0,
  }
}

function getOrCreateStats(statsByVenue: Map<string, VenuePulseStats>, venueId: string): VenuePulseStats {
  const existing = statsByVenue.get(venueId)
  if (existing) return existing

  const stats = createEmptyStats()
  statsByVenue.set(venueId, stats)
  return stats
}

function buildVenuePulseStats(pulses: Pulse[], now: Date): Map<string, VenuePulseStats> {
  const fifteenMinutesAgoMs = now.getTime() - TRENDING_THRESHOLDS.TIME_WINDOW_MINUTES * 60 * 1000
  const thirtyMinutesAgoMs = now.getTime() - 30 * 60 * 1000
  const statsByVenue = new Map<string, VenuePulseStats>()

  for (const pulse of pulses) {
    const stats = getOrCreateStats(statsByVenue, pulse.venueId)
    const createdAtMs = new Date(pulse.createdAt).getTime()

    stats.all.push(pulse)
    stats.uniqueUsers.add(pulse.userId)

    if (createdAtMs > fifteenMinutesAgoMs) {
      stats.recent.push(pulse)
      stats.recentUniqueUsers.add(pulse.userId)
      stats.velocity += ENERGY_VALUES[pulse.energyRating]
    } else if (createdAtMs > thirtyMinutesAgoMs) {
      stats.previous.push(pulse)
      stats.velocity -= ENERGY_VALUES[pulse.energyRating]
    }
  }

  return statsByVenue
}

export function shouldRemovePreTrending(venue: Venue, pulses: Pulse[]): boolean {
  if (!venue.preTrending) return false
  
  const stats = buildVenuePulseStats(pulses, new Date()).get(venue.id)
  
  return (stats?.uniqueUsers.size ?? 0) >= TRENDING_THRESHOLDS.MIN_UNIQUE_USERS
}

export function calculateScoreVelocity(venue: Venue, pulses: Pulse[]): number {
  return buildVenuePulseStats(pulses, new Date()).get(venue.id)?.velocity ?? 0
}

export function getTrendingSections(
  venues: Venue[],
  pulses: Pulse[]
): TrendingSection[] {
  const now = new Date()
  const updatedAt = now.toISOString()
  const statsByVenue = buildVenuePulseStats(pulses, now)
  const velocityByVenue = new Map<string, number>()
  const getVelocity = (venue: Venue) => {
    const cached = velocityByVenue.get(venue.id)
    if (cached !== undefined) return cached

    const velocity = statsByVenue.get(venue.id)?.velocity ?? 0
    velocityByVenue.set(venue.id, velocity)
    return velocity
  }
  
  const trendingNow = venues.filter(venue => {
    const stats = statsByVenue.get(venue.id)
    
    return (
      !venue.preTrending &&
      (stats?.recentUniqueUsers.size ?? 0) >= TRENDING_THRESHOLDS.MIN_UNIQUE_USERS &&
      (stats?.recent.length ?? 0) >= TRENDING_THRESHOLDS.MIN_PULSES_15MIN &&
      venue.pulseScore >= 50
    )
  }).sort((a, b) => b.pulseScore - a.pulseScore)
  
  const justPopped = venues.filter(venue => {
    const velocity = getVelocity(venue)
    return (
      !venue.preTrending &&
      velocity >= TRENDING_THRESHOLDS.RAPID_SCORE_INCREASE &&
      venue.pulseScore >= 40
    )
  }).sort((a, b) => {
    return getVelocity(b) - getVelocity(a)
  })
  
  const gainingEnergy = venues.filter(venue => {
    const isAlreadyTrending = trendingNow.includes(venue)
    const isJustPopped = justPopped.includes(venue)
    const velocity = getVelocity(venue)
    
    return (
      !venue.preTrending &&
      !isAlreadyTrending &&
      !isJustPopped &&
      venue.pulseScore >= TRENDING_THRESHOLDS.GAINING_ENERGY_THRESHOLD &&
      velocity > 0
    )
  }).sort((a, b) => b.pulseScore - a.pulseScore)
  
  const expectedToBeBusy = venues.filter(venue => {
    return (
      venue.preTrending === true &&
      venue.pulseScore < 30
    )
  }).sort((a, b) => (b.pulseScore || 0) - (a.pulseScore || 0))
  
  const sections: TrendingSection[] = []
  
  if (trendingNow.length > 0) {
    sections.push({
      title: 'Trending Now',
      venues: trendingNow.slice(0, 5),
      description: 'Live verified activity from multiple users',
      updatedAt
    })
  }
  
  if (justPopped.length > 0) {
    sections.push({
      title: 'Just Popped Off',
      venues: justPopped.slice(0, 3),
      description: 'Rapid energy surge in the last 15 minutes',
      updatedAt
    })
  }
  
  if (gainingEnergy.length > 0) {
    sections.push({
      title: 'Gaining Energy',
      venues: gainingEnergy.slice(0, 5),
      description: 'Building momentum right now',
      updatedAt
    })
  }
  
  if (expectedToBeBusy.length > 0) {
    sections.push({
      title: 'Expected to Be Busy',
      venues: expectedToBeBusy.slice(0, 4),
      description: 'Popular spots to check out',
      updatedAt
    })
  }
  
  return sections
}

export function calculateVenueAnalytics(
  venue: Venue,
  pulses: Pulse[],
  allHashtags?: { venueId: string; hashtags: string[]; verified: boolean }[]
): VenueAnalytics {
  const uniqueUsers = buildVenuePulseStats(pulses, new Date()).get(venue.id)?.uniqueUsers ?? new Set<string>()
  
  let preTrendingConversionRate: number | undefined
  let timeToFirstRealActivity: number | undefined
  
  if (venue.seeded && venue.firstRealCheckInAt) {
    const createdAt = new Date(venue.firstRealCheckInAt)
    const firstCheckIn = new Date(venue.firstRealCheckInAt)
    timeToFirstRealActivity = (firstCheckIn.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    
    if (uniqueUsers.size >= TRENDING_THRESHOLDS.MIN_UNIQUE_USERS) {
      preTrendingConversionRate = 1.0
    } else {
      const hoursSinceSeed = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceSeed > TRENDING_THRESHOLDS.PRE_TRENDING_CONVERSION_HOURS) {
        preTrendingConversionRate = uniqueUsers.size / TRENDING_THRESHOLDS.MIN_UNIQUE_USERS
      }
    }
  }
  
  let seededHashtagConversionRate: number | undefined
  if (allHashtags) {
    const venueHashtagData = allHashtags.filter(h => h.venueId === venue.id)
    const totalHashtags = venueHashtagData.reduce((sum, h) => sum + h.hashtags.length, 0)
    const verifiedHashtags = venueHashtagData.filter(h => h.verified).reduce((sum, h) => sum + h.hashtags.length, 0)
    
    if (totalHashtags > 0) {
      seededHashtagConversionRate = verifiedHashtags / totalHashtags
    }
  }
  
  return {
    venueId: venue.id,
    preTrendingConversionRate,
    timeToFirstRealActivity,
    seededHashtagConversionRate,
    totalVerifiedCheckIns: uniqueUsers.size,
    lastAnalyzedAt: new Date().toISOString()
  }
}

export function calculateVenuesAnalytics(
  venues: Venue[],
  pulses: Pulse[],
  allHashtags?: { venueId: string; hashtags: string[]; verified: boolean }[]
): VenueAnalytics[] {
  const statsByVenue = buildVenuePulseStats(pulses, new Date())
  const hashtagsByVenue = new Map<string, { total: number; verified: number }>()

  for (const item of allHashtags ?? []) {
    const stats = hashtagsByVenue.get(item.venueId) ?? { total: 0, verified: 0 }
    stats.total += item.hashtags.length
    if (item.verified) stats.verified += item.hashtags.length
    hashtagsByVenue.set(item.venueId, stats)
  }

  return venues.map((venue) => {
    const uniqueUsers = statsByVenue.get(venue.id)?.uniqueUsers ?? new Set<string>()
    const hashtagStats = hashtagsByVenue.get(venue.id)

    let preTrendingConversionRate: number | undefined
    let timeToFirstRealActivity: number | undefined

    if (venue.seeded && venue.firstRealCheckInAt) {
      const createdAt = new Date(venue.firstRealCheckInAt)
      const firstCheckIn = new Date(venue.firstRealCheckInAt)
      timeToFirstRealActivity = (firstCheckIn.getTime() - createdAt.getTime()) / (1000 * 60 * 60)

      if (uniqueUsers.size >= TRENDING_THRESHOLDS.MIN_UNIQUE_USERS) {
        preTrendingConversionRate = 1.0
      } else {
        const hoursSinceSeed = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60)
        if (hoursSinceSeed > TRENDING_THRESHOLDS.PRE_TRENDING_CONVERSION_HOURS) {
          preTrendingConversionRate = uniqueUsers.size / TRENDING_THRESHOLDS.MIN_UNIQUE_USERS
        }
      }
    }

    return {
      venueId: venue.id,
      preTrendingConversionRate,
      timeToFirstRealActivity,
      seededHashtagConversionRate: hashtagStats && hashtagStats.total > 0
        ? hashtagStats.verified / hashtagStats.total
        : undefined,
      totalVerifiedCheckIns: uniqueUsers.size,
      lastAnalyzedAt: new Date().toISOString(),
    }
  })
}

export function getPreTrendingLabel(venue: Venue): string {
  if (!venue.preTrending) return ''
  if (venue.preTrendingLabel) return venue.preTrendingLabel
  
  const hour = new Date().getHours()
  
  if (venue.category === 'cafes' && hour >= 6 && hour < 12) {
    return 'Usually busy mornings'
  }
  
  if ((venue.category === 'nightlife' || venue.category === 'music') && hour >= 21) {
    return 'Likely trending tonight'
  }
  
  if (venue.category === 'sports') {
    return 'Game day hotspot'
  }
  
  if (venue.category === 'food' && (hour >= 11 && hour < 14 || hour >= 17 && hour < 21)) {
    return 'Peak dining hours'
  }
  
  return 'Expected to be busy'
}

export function shouldPruneSeededData(analytics: VenueAnalytics): boolean {
  if (!analytics.preTrendingConversionRate) return false
  
  const hoursSinceSeed = analytics.timeToFirstRealActivity || 0
  
  if (hoursSinceSeed > TRENDING_THRESHOLDS.PRE_TRENDING_CONVERSION_HOURS * 7) {
    return analytics.preTrendingConversionRate < 0.1
  }
  
  return false
}

export function updateVenueWithCheckIn(venue: Venue, pulse: Pulse): Venue {
  const updates: Partial<Venue> = {}
  
  if (venue.preTrending) {
    if (!venue.firstRealCheckInAt) {
      updates.firstRealCheckInAt = pulse.createdAt
    }
    updates.verifiedCheckInCount = (venue.verifiedCheckInCount || 0) + 1
    
    if ((venue.verifiedCheckInCount || 0) >= TRENDING_THRESHOLDS.MIN_UNIQUE_USERS) {
      updates.preTrending = false
      updates.preTrendingLabel = undefined
    }
  } else {
    updates.verifiedCheckInCount = (venue.verifiedCheckInCount || 0) + 1
  }
  
  return {
    ...venue,
    ...updates
  }
}
