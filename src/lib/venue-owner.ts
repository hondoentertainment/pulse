import type { Venue, Pulse, EnergyRating } from './types'

/**
 * Venue Owner Tools Engine
 *
 * Venue claim/verification, analytics dashboard, announcements,
 * and promoted placement in trending.
 */

export type ClaimStatus = 'pending' | 'verified' | 'rejected'

export interface VenueClaim {
  id: string
  venueId: string
  claimantUserId: string
  businessName: string
  businessEmail: string
  verificationMethod: 'email' | 'phone' | 'document'
  status: ClaimStatus
  createdAt: string
  verifiedAt?: string
  rejectedReason?: string
}

export interface VenueAnnouncement {
  id: string
  venueId: string
  ownerUserId: string
  title: string
  body: string
  type: 'general' | 'event' | 'special' | 'response'
  responseToPulseId?: string
  createdAt: string
  expiresAt?: string
  pinned: boolean
}

export interface VenueOwnerDashboard {
  venueId: string
  venueName: string
  /** Current pulse score */
  currentScore: number
  /** Total pulses in last 24h */
  pulsesLast24h: number
  /** Total pulses in last 7d */
  pulsesLast7d: number
  /** Unique visitors in last 7d */
  uniqueVisitors7d: number
  /** Peak hours analysis */
  peakHours: PeakHourAnalysis[]
  /** Energy distribution */
  energyDistribution: Record<EnergyRating, number>
  /** Category breakdown of visitors */
  topHashtags: { tag: string; count: number }[]
  /** Average energy rating (0-3 scale) */
  averageEnergy: number
  /** Trend: up, down, flat */
  trend: 'up' | 'down' | 'flat'
  /** Day-over-day change */
  scoreDelta: number
}

export interface PeakHourAnalysis {
  hour: number
  dayOfWeek: number
  averagePulseCount: number
  averageEnergy: number
}

export interface PromotedPlacement {
  id: string
  venueId: string
  ownerUserId: string
  startDate: string
  endDate: string
  budget: number
  impressions: number
  clicks: number
  active: boolean
}

/**
 * Create a venue claim request.
 */
export function createVenueClaim(
  venueId: string,
  userId: string,
  businessName: string,
  businessEmail: string,
  verificationMethod: 'email' | 'phone' | 'document' = 'email'
): VenueClaim {
  return {
    id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    claimantUserId: userId,
    businessName,
    businessEmail,
    verificationMethod,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Verify a venue claim.
 */
export function verifyVenueClaim(claim: VenueClaim): VenueClaim {
  return {
    ...claim,
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  }
}

/**
 * Build a venue owner analytics dashboard from pulse data.
 */
export function buildOwnerDashboard(
  venue: Venue,
  pulses: Pulse[],
): VenueOwnerDashboard {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const venuePulses = pulses.filter(p => p.venueId === venue.id)

  const last24h = venuePulses.filter(p => now - new Date(p.createdAt).getTime() < day)
  const last7d = venuePulses.filter(p => now - new Date(p.createdAt).getTime() < 7 * day)
  const prev7d = venuePulses.filter(p => {
    const age = now - new Date(p.createdAt).getTime()
    return age >= 7 * day && age < 14 * day
  })

  // Unique visitors (by userId)
  const uniqueVisitors7d = new Set(last7d.map(p => p.userId)).size

  // Energy distribution
  const energyDistribution: Record<EnergyRating, number> = {
    dead: 0, chill: 0, buzzing: 0, electric: 0,
  }
  for (const p of last7d) {
    energyDistribution[p.energyRating]++
  }

  // Average energy
  const energyValues: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
  const averageEnergy = last7d.length > 0
    ? last7d.reduce((sum, p) => sum + energyValues[p.energyRating], 0) / last7d.length
    : 0

  // Peak hours
  const hourCounts: Record<string, { count: number; energy: number }> = {}
  for (const p of last7d) {
    const d = new Date(p.createdAt)
    const key = `${d.getDay()}-${d.getHours()}`
    if (!hourCounts[key]) hourCounts[key] = { count: 0, energy: 0 }
    hourCounts[key].count++
    hourCounts[key].energy += energyValues[p.energyRating]
  }

  const peakHours: PeakHourAnalysis[] = Object.entries(hourCounts)
    .map(([key, val]) => {
      const [dow, hour] = key.split('-').map(Number)
      return {
        hour,
        dayOfWeek: dow,
        averagePulseCount: val.count,
        averageEnergy: val.count > 0 ? val.energy / val.count : 0,
      }
    })
    .sort((a, b) => b.averagePulseCount - a.averagePulseCount)

  // Top hashtags
  const tagCounts: Record<string, number> = {}
  for (const p of last7d) {
    for (const tag of p.hashtags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }
  const topHashtags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }))

  // Trend
  const currentWeekScore = last7d.length
  const prevWeekScore = prev7d.length
  const scoreDelta = currentWeekScore - prevWeekScore
  const trend = scoreDelta > 2 ? 'up' : scoreDelta < -2 ? 'down' : 'flat'

  return {
    venueId: venue.id,
    venueName: venue.name,
    currentScore: venue.pulseScore,
    pulsesLast24h: last24h.length,
    pulsesLast7d: last7d.length,
    uniqueVisitors7d,
    peakHours: peakHours.slice(0, 10),
    energyDistribution,
    topHashtags,
    averageEnergy: Math.round(averageEnergy * 100) / 100,
    trend,
    scoreDelta,
  }
}

/**
 * Create a venue announcement.
 */
export function createAnnouncement(
  venueId: string,
  ownerUserId: string,
  title: string,
  body: string,
  type: VenueAnnouncement['type'] = 'general',
  responseToPulseId?: string,
  expiresInHours?: number
): VenueAnnouncement {
  return {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    ownerUserId,
    title,
    body,
    type,
    responseToPulseId,
    createdAt: new Date().toISOString(),
    expiresAt: expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : undefined,
    pinned: false,
  }
}

/**
 * Check if a venue is claimed and verified.
 */
export function isVenueVerified(claims: VenueClaim[], venueId: string): boolean {
  return claims.some(c => c.venueId === venueId && c.status === 'verified')
}

/**
 * Get the verified owner of a venue.
 */
export function getVenueOwner(claims: VenueClaim[], venueId: string): string | null {
  const claim = claims.find(c => c.venueId === venueId && c.status === 'verified')
  return claim?.claimantUserId ?? null
}

/**
 * Get active announcements for a venue.
 */
export function getActiveAnnouncements(
  announcements: VenueAnnouncement[],
  venueId: string
): VenueAnnouncement[] {
  const now = Date.now()
  return announcements
    .filter(a => a.venueId === venueId)
    .filter(a => !a.expiresAt || new Date(a.expiresAt).getTime() > now)
    .sort((a, b) => {
      // Pinned first, then by date
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
}

/**
 * Check if a promoted placement is active.
 */
export function isPromotedActive(placement: PromotedPlacement): boolean {
  const now = Date.now()
  return (
    placement.active &&
    new Date(placement.startDate).getTime() <= now &&
    new Date(placement.endDate).getTime() > now
  )
}

/**
 * Get promoted venues from placements.
 */
export function getPromotedVenues(
  placements: PromotedPlacement[],
  venues: Venue[]
): Venue[] {
  const activeIds = new Set(
    placements.filter(isPromotedActive).map(p => p.venueId)
  )
  return venues.filter(v => activeIds.has(v.id))
}
