import type { Venue, User } from './types'
import { calculateDistance } from './pulse-engine'
import { getPeakConfig } from './time-contextual-scoring'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TonightsPick {
  venue: Venue
  score: number
  reasons: string[]
  explanation: string
  confidence: number
  alternates: Venue[]
}

export interface PickParams {
  venues: Venue[]
  user: User
  userLocation: { lat: number; lng: number } | null
  currentTime: Date
  friendActivity?: Record<string, { count: number; friendIds: string[] }>
  recentCheckins?: string[]
  weatherCondition?: 'clear' | 'rain' | 'snow' | 'hot'
}

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  pulseAndTrending: 0.30,
  userPreference: 0.20,
  friendPresence: 0.20,
  distance: 0.15,
  timeAppropriateness: 0.10,
  novelty: 0.05,
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

// ---------------------------------------------------------------------------
// Individual scoring factors
// ---------------------------------------------------------------------------

function scorePulseAndTrending(venue: Venue): { score: number; reason: string | null } {
  let score = 0
  let reason: string | null = null

  // Raw pulse score contribution (0-1)
  const pulseNorm = clamp01(venue.pulseScore / 100)
  score += pulseNorm * 0.6

  // Trending velocity contribution
  if (venue.scoreVelocity && venue.scoreVelocity > 0) {
    const velocityNorm = clamp01(venue.scoreVelocity / 10)
    score += velocityNorm * 0.4
    if (velocityNorm > 0.3) {
      reason = 'surging right now'
    }
  } else {
    score += pulseNorm * 0.4
  }

  if (!reason && pulseNorm >= 0.7) {
    reason = 'peak energy tonight'
  } else if (!reason && pulseNorm >= 0.5) {
    reason = 'buzzing tonight'
  }

  return { score: clamp01(score), reason }
}

function scoreUserPreference(
  venue: Venue,
  user: User,
  _allVenues: Venue[],
): { score: number; reason: string | null } {
  let score = 0
  let reason: string | null = null
  const cat = venue.category?.toLowerCase() ?? ''

  // Match against favorite categories
  if (user.favoriteCategories && user.favoriteCategories.length > 0) {
    const match = user.favoriteCategories.some(
      (fc) => cat.includes(fc.toLowerCase()) || fc.toLowerCase().includes(cat),
    )
    if (match) {
      score += 0.6
      reason = `your favorite ${venue.category ?? 'spot'}`
    }
  }

  // Check-in frequency for this venue
  if (user.venueCheckInHistory) {
    const venueCheckins = user.venueCheckInHistory[venue.id] ?? 0
    const total = Object.values(user.venueCheckInHistory).reduce((a, b) => a + b, 0)
    if (total > 0 && venueCheckins > 0) {
      score += 0.4 * clamp01(venueCheckins / total)
      if (venueCheckins >= 3 && !reason) {
        reason = 'one of your go-to spots'
      }
    }
  }

  // Favorite venue boost
  if (user.favoriteVenues?.includes(venue.id)) {
    score += 0.2
    if (!reason) reason = 'one of your favorites'
  }

  return { score: clamp01(score), reason }
}

function scoreFriendPresence(
  venue: Venue,
  friendActivity?: Record<string, { count: number; friendIds: string[] }>,
): { score: number; reason: string | null; friendCount: number } {
  if (!friendActivity) return { score: 0, reason: null, friendCount: 0 }

  const activity = friendActivity[venue.id]
  if (!activity || activity.count === 0) return { score: 0, reason: null, friendCount: 0 }

  const friendCount = activity.count
  const score = clamp01(friendCount / 4) // 4+ friends = max score
  const reason =
    friendCount === 1
      ? '1 friend nearby'
      : `${friendCount} friends nearby`

  return { score, reason, friendCount }
}

function scoreDistance(
  venue: Venue,
  userLocation: { lat: number; lng: number } | null,
): { score: number; reason: string | null; distance?: number } {
  if (!userLocation) return { score: 0.5, reason: null }

  const dist = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    venue.location.lat,
    venue.location.lng,
  )

  // Decay: 1.0 at 0 miles, ~0 at 5+ miles
  const score = clamp01(1 - dist / 5)
  let reason: string | null = null
  if (dist < 0.3) reason = 'steps away'
  else if (dist < 1) reason = 'nearby'

  return { score, reason, distance: Math.round(dist * 10) / 10 }
}

function scoreTimeAppropriateness(
  venue: Venue,
  currentTime: Date,
): { score: number; reason: string | null } {
  const config = getPeakConfig(venue.category, currentTime)
  const score = clamp01(config.multiplier / 2.5)
  let reason: string | null = null

  if (config.multiplier >= 1.5) {
    reason = 'perfect timing'
  }

  return { score, reason }
}

function scoreNovelty(
  venue: Venue,
  user: User,
  recentCheckins?: string[],
): { score: number; reason: string | null } {
  const visits = user.venueCheckInHistory?.[venue.id] ?? 0
  const recentlyVisited = recentCheckins?.includes(venue.id)

  if (visits === 0 && !recentlyVisited) {
    return { score: 1.0, reason: 'new spot for you' }
  }

  if (recentlyVisited) {
    return { score: 0.1, reason: null }
  }

  return { score: clamp01(0.3 / visits), reason: null }
}

// ---------------------------------------------------------------------------
// Main pick function
// ---------------------------------------------------------------------------

export function pickTonightsVenue(params: PickParams): TonightsPick | null {
  const {
    venues,
    user,
    userLocation,
    currentTime,
    friendActivity,
    recentCheckins,
  } = params

  if (venues.length === 0) return null

  const scoredVenues = venues.map((venue) => {
    const reasons: string[] = []
    let totalScore = 0

    // 1. Pulse score & trending (30%)
    const pulse = scorePulseAndTrending(venue)
    totalScore += WEIGHTS.pulseAndTrending * pulse.score
    if (pulse.reason) reasons.push(pulse.reason)

    // 2. User preference (20%)
    const pref = scoreUserPreference(venue, user, venues)
    totalScore += WEIGHTS.userPreference * pref.score
    if (pref.reason) reasons.push(pref.reason)

    // 3. Friend presence (20%)
    const friends = scoreFriendPresence(venue, friendActivity)
    totalScore += WEIGHTS.friendPresence * friends.score
    if (friends.reason) reasons.push(friends.reason)

    // 4. Distance (15%)
    const dist = scoreDistance(venue, userLocation)
    totalScore += WEIGHTS.distance * dist.score
    if (dist.reason) reasons.push(dist.reason)

    // 5. Time-appropriateness (10%)
    const time = scoreTimeAppropriateness(venue, currentTime)
    totalScore += WEIGHTS.timeAppropriateness * time.score
    if (time.reason) reasons.push(time.reason)

    // 6. Novelty (5%)
    const novelty = scoreNovelty(venue, user, recentCheckins)
    totalScore += WEIGHTS.novelty * novelty.score
    if (novelty.reason) reasons.push(novelty.reason)

    return {
      venue,
      score: Math.round(totalScore * 1000) / 1000,
      reasons: reasons.length > 0 ? reasons : ['recommended for you'],
      friendCount: friends.friendCount,
      distance: dist.distance,
    }
  })

  // Sort descending by score
  scoredVenues.sort((a, b) => b.score - a.score)

  const top = scoredVenues[0]
  if (!top) return null

  const alternates = getAlternates(
    scoredVenues.map((s) => s.venue),
    { venue: top.venue, score: top.score, reasons: top.reasons, explanation: '', confidence: 0, alternates: [] },
    3,
  )

  const explanation = generateExplanation({
    venue: top.venue,
    score: top.score,
    reasons: top.reasons,
    explanation: '',
    confidence: 0,
    alternates,
  })

  // Confidence: how much better the top pick is vs the average
  const avgScore =
    scoredVenues.length > 1
      ? scoredVenues.slice(1).reduce((sum, s) => sum + s.score, 0) / (scoredVenues.length - 1)
      : 0
  const confidence = clamp01(avgScore > 0 ? (top.score - avgScore) / top.score + 0.5 : 0.8)

  return {
    venue: top.venue,
    score: top.score,
    reasons: top.reasons,
    explanation,
    confidence: Math.round(confidence * 100) / 100,
    alternates,
  }
}

// ---------------------------------------------------------------------------
// Explanation generation
// ---------------------------------------------------------------------------

export function generateExplanation(pick: TonightsPick): string {
  const { venue, reasons } = pick
  const venueName = venue.name
  const cat = venue.category?.toLowerCase() ?? 'spot'

  // Build a natural language explanation from the top reasons
  if (reasons.length === 0) {
    return `${venueName} looks great tonight`
  }

  // Combine the most important reasons
  const parts: string[] = []

  // Lead with preference / category match
  const prefReason = reasons.find(
    (r) => r.includes('favorite') || r.includes('go-to'),
  )
  const friendReason = reasons.find((r) => r.includes('friend'))
  const trendReason = reasons.find(
    (r) => r.includes('surging') || r.includes('buzzing') || r.includes('peak energy'),
  )
  const noveltyReason = reasons.find((r) => r.includes('new spot'))
  const proximityReason = reasons.find(
    (r) => r.includes('steps away') || r.includes('nearby'),
  )

  if (prefReason && trendReason) {
    return `Your favorite ${cat} is ${trendReason}${friendReason ? ` \u2014 ${friendReason}` : ''}`
  }

  if (friendReason && trendReason) {
    return `${venueName} is ${trendReason} \u2014 ${friendReason}`
  }

  if (prefReason) {
    parts.push(`${venueName} is ${prefReason}`)
  } else if (noveltyReason) {
    parts.push(`${venueName} is a ${noveltyReason}`)
  } else if (trendReason) {
    parts.push(`${venueName} is ${trendReason}`)
  } else {
    parts.push(`${venueName} looks great tonight`)
  }

  if (friendReason && !parts[0].includes('friend')) {
    parts.push(friendReason)
  }

  if (proximityReason && parts.length < 2) {
    parts.push(`and it's ${proximityReason}`)
  }

  return parts.join(' \u2014 ')
}

// ---------------------------------------------------------------------------
// Alternates
// ---------------------------------------------------------------------------

export function getAlternates(
  venues: Venue[],
  pick: TonightsPick,
  count: number = 3,
): Venue[] {
  return venues
    .filter((v) => v.id !== pick.venue.id)
    .slice(0, count)
}

// ---------------------------------------------------------------------------
// Time gate
// ---------------------------------------------------------------------------

export function shouldShowPick(currentTime: Date): boolean {
  const hour = currentTime.getHours()
  // Show between 5 PM (17) and 2 AM (next day)
  return hour >= 17 || hour < 2
}

// ---------------------------------------------------------------------------
// Refresh logic
// ---------------------------------------------------------------------------

export function refreshPick(
  currentPick: TonightsPick,
  newData: PickParams,
): { shouldRefresh: boolean; newPick: TonightsPick | null } {
  const newPick = pickTonightsVenue(newData)

  if (!newPick) {
    return { shouldRefresh: false, newPick: null }
  }

  // Refresh if a different venue wins
  if (newPick.venue.id !== currentPick.venue.id) {
    // Only switch if the new pick is significantly better (>10% margin)
    const margin = (newPick.score - currentPick.score) / currentPick.score
    if (margin > 0.1) {
      return { shouldRefresh: true, newPick }
    }
  }

  // Refresh if score changed significantly (data update)
  const scoreDiff = Math.abs(newPick.score - currentPick.score)
  if (scoreDiff > 0.05) {
    return { shouldRefresh: true, newPick }
  }

  return { shouldRefresh: false, newPick: null }
}
