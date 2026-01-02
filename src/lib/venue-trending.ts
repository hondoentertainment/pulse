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

export function shouldRemovePreTrending(venue: Venue, pulses: Pulse[]): boolean {
  if (!venue.preTrending) return false
  
  const venuePulses = pulses.filter(p => p.venueId === venue.id)
  const uniqueUsers = new Set(venuePulses.map(p => p.userId))
  
  return uniqueUsers.size >= TRENDING_THRESHOLDS.MIN_UNIQUE_USERS
}

export function calculateScoreVelocity(venue: Venue, pulses: Pulse[]): number {
  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - TRENDING_THRESHOLDS.TIME_WINDOW_MINUTES * 60 * 1000)
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
  
  const recentPulses = pulses.filter(p => 
    p.venueId === venue.id && 
    new Date(p.createdAt) > fifteenMinutesAgo
  )
  
  const previousPulses = pulses.filter(p => 
    p.venueId === venue.id && 
    new Date(p.createdAt) > thirtyMinutesAgo &&
    new Date(p.createdAt) <= fifteenMinutesAgo
  )
  
  const recentScore = recentPulses.reduce((sum, p) => {
    const energyValues = { dead: 0, chill: 25, buzzing: 50, electric: 100 }
    return sum + energyValues[p.energyRating]
  }, 0)
  
  const previousScore = previousPulses.reduce((sum, p) => {
    const energyValues = { dead: 0, chill: 25, buzzing: 50, electric: 100 }
    return sum + energyValues[p.energyRating]
  }, 0)
  
  return recentScore - previousScore
}

export function getTrendingSections(
  venues: Venue[],
  pulses: Pulse[]
): TrendingSection[] {
  const now = new Date()
  const updatedAt = now.toISOString()
  const fifteenMinutesAgo = new Date(now.getTime() - TRENDING_THRESHOLDS.TIME_WINDOW_MINUTES * 60 * 1000)
  
  const trendingNow = venues.filter(venue => {
    const venuePulses = pulses.filter(p => 
      p.venueId === venue.id && 
      new Date(p.createdAt) > fifteenMinutesAgo
    )
    const uniqueUsers = new Set(venuePulses.map(p => p.userId))
    
    return (
      !venue.preTrending &&
      uniqueUsers.size >= TRENDING_THRESHOLDS.MIN_UNIQUE_USERS &&
      venuePulses.length >= TRENDING_THRESHOLDS.MIN_PULSES_15MIN &&
      venue.pulseScore >= 50
    )
  }).sort((a, b) => b.pulseScore - a.pulseScore)
  
  const justPopped = venues.filter(venue => {
    const velocity = calculateScoreVelocity(venue, pulses)
    return (
      !venue.preTrending &&
      velocity >= TRENDING_THRESHOLDS.RAPID_SCORE_INCREASE &&
      venue.pulseScore >= 40
    )
  }).sort((a, b) => {
    const aVelocity = calculateScoreVelocity(a, pulses)
    const bVelocity = calculateScoreVelocity(b, pulses)
    return bVelocity - aVelocity
  })
  
  const gainingEnergy = venues.filter(venue => {
    const isAlreadyTrending = trendingNow.includes(venue)
    const isJustPopped = justPopped.includes(venue)
    const velocity = calculateScoreVelocity(venue, pulses)
    
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
  const venuePulses = pulses.filter(p => p.venueId === venue.id)
  const uniqueUsers = new Set(venuePulses.map(p => p.userId))
  
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
