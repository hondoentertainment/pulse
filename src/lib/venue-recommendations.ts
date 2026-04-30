import type { Venue, Pulse, User } from './types'
import { getTimeOfDay, getPeakConfig, normalizeCategoryKeyPublic } from './time-contextual-scoring'
import { calculateDistance } from './pulse-engine'

/**
 * Venue Recommendation Engine
 *
 * Generates personalized venue suggestions based on:
 * - Categories the user frequents
 * - Time-aware recommendations (brunch in morning, bars at night)
 * - Friend activity signals
 * - Weighted trending by user preferences
 */

export interface Recommendation {
  venue: Venue
  score: number
  reasons: RecommendationReason[]
}

export interface RecommendationReason {
  type: 'category_match' | 'time_appropriate' | 'friend_activity' | 'trending' | 'new_discovery' | 'nearby' | 'live_intel'
  label: string
}

/**
 * Build a category preference map from a user's check-in history.
 * Returns { categoryKey: frequency } normalized to 0-1.
 */
export function buildCategoryPreferences(
  user: User,
  venues: Venue[]
): Record<string, number> {
  const history = user.venueCheckInHistory ?? {}
  const counts: Record<string, number> = {}
  let total = 0

  for (const [venueId, checkIns] of Object.entries(history)) {
    const venue = venues.find(v => v.id === venueId)
    if (!venue) continue
    const key = normalizeCategoryKeyPublic(venue.category)
    counts[key] = (counts[key] ?? 0) + checkIns
    total += checkIns
  }

  if (total === 0) return {}

  const prefs: Record<string, number> = {}
  for (const [key, count] of Object.entries(counts)) {
    prefs[key] = count / total
  }
  return prefs
}

/**
 * Get friend activity at venues.
 * Returns { venueId: friendCount } for venues where friends have pulsed recently.
 */
export function getFriendActivity(
  user: User,
  pulses: Pulse[],
  windowMinutes: number = 180
): Record<string, { count: number; friendIds: string[] }> {
  const cutoff = Date.now() - windowMinutes * 60 * 1000
  const friendSet = new Set(user.friends ?? [])
  const activity: Record<string, { count: number; friendIds: string[] }> = {}

  for (const pulse of pulses) {
    if (new Date(pulse.createdAt).getTime() < cutoff) continue
    if (!friendSet.has(pulse.userId)) continue

    if (!activity[pulse.venueId]) {
      activity[pulse.venueId] = { count: 0, friendIds: [] }
    }
    if (!activity[pulse.venueId].friendIds.includes(pulse.userId)) {
      activity[pulse.venueId].count++
      activity[pulse.venueId].friendIds.push(pulse.userId)
    }
  }

  return activity
}

/**
 * Format friend activity label.
 */
export function formatFriendActivityLabel(count: number): string {
  if (count === 1) return '1 friend pulsed here tonight'
  return `${count} friends pulsed here tonight`
}

/**
 * Generate personalized venue recommendations.
 */
export function getRecommendations(
  user: User,
  venues: Venue[],
  pulses: Pulse[],
  userLocation?: { lat: number; lng: number },
  date: Date = new Date(),
  limit: number = 10
): Recommendation[] {
  const prefs = buildCategoryPreferences(user, venues)
  const friendAct = getFriendActivity(user, pulses)
  const tod = getTimeOfDay(date)
  const visited = new Set(Object.keys(user.venueCheckInHistory ?? {}))
  const favorites = new Set(user.favoriteVenues ?? [])
  const followed = new Set(user.followedVenues ?? [])

  const scored: Recommendation[] = venues.map(venue => {
    let score = 0
    const reasons: RecommendationReason[] = []
    const catKey = normalizeCategoryKeyPublic(venue.category)

    // 1. Category preference match (0-30 points)
    const prefWeight = prefs[catKey] ?? 0
    if (prefWeight > 0) {
      score += prefWeight * 30
      reasons.push({
        type: 'category_match',
        label: `Based on your ${venue.category ?? 'venue'} visits`
      })
    }

    // 2. Time-appropriate bonus (0-25 points)
    const peakConfig = getPeakConfig(venue.category, date)
    if (peakConfig.multiplier >= 1.5) {
      score += peakConfig.multiplier * 10
      reasons.push({
        type: 'time_appropriate',
        label: getTimeRecommendationLabel(catKey, tod)
      })
    }

    // 3. Friend activity (0-35 points, strongest signal)
    const friendData = friendAct[venue.id]
    if (friendData) {
      score += Math.min(35, friendData.count * 12)
      reasons.push({
        type: 'friend_activity',
        label: formatFriendActivityLabel(friendData.count)
      })
    }

    // 4. Currently trending (0-20 points)
    if (venue.pulseScore >= 50) {
      score += (venue.pulseScore / 100) * 20
      reasons.push({ type: 'trending', label: 'Trending right now' })
    }

    // 4b. Real-time venue intelligence (0-22 points)
    if (venue.liveSummary && venue.liveSummary.reportCount > 0) {
      const live = venue.liveSummary
      const highConfidenceSignals = Object.values(live.confidence).filter(level => level === 'high').length
      score += Math.min(12, live.reportCount * 2) + highConfidenceSignals * 3

      if (live.waitTime !== null && live.waitTime <= 5) {
        score += 7
        reasons.push({ type: 'live_intel', label: 'Walk right in' })
      } else if (live.waitTime !== null && live.waitTime >= 25) {
        score -= 8
        reasons.push({ type: 'live_intel', label: 'Line risk reported' })
      } else if (live.crowdLevel >= 70) {
        score += 5
        reasons.push({ type: 'live_intel', label: 'High-confidence crowd' })
      } else if (live.musicGenre || live.nowPlaying) {
        score += 4
        reasons.push({ type: 'live_intel', label: 'Music confirmed' })
      } else {
        reasons.push({ type: 'live_intel', label: 'Fresh live intel' })
      }
    }

    // 5. New discovery bonus (0-10 points) — venues user hasn't visited
    if (!visited.has(venue.id) && !favorites.has(venue.id)) {
      score += 10
      reasons.push({ type: 'new_discovery', label: 'New spot for you' })
    }

    // 6. Proximity bonus (0-15 points)
    if (userLocation) {
      const dist = calculateDistance(
        userLocation.lat, userLocation.lng,
        venue.location.lat, venue.location.lng
      )
      if (dist <= 1) {
        score += 15
        reasons.push({ type: 'nearby', label: 'Nearby' })
      } else if (dist <= 5) {
        score += 10
      } else if (dist <= 15) {
        score += 5
      }
    }

    // Slight penalty for already-followed (user already knows about it)
    if (followed.has(venue.id)) {
      score *= 0.8
    }

    return { venue, score, reasons }
  })

  return scored
    .filter(r => r.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function getTimeRecommendationLabel(catKey: string, tod: string): string {
  const labels: Record<string, Record<string, string>> = {
    cafe: {
      early_morning: 'Great for an early coffee',
      morning: 'Perfect morning spot',
      afternoon: 'Afternoon pick-me-up',
    },
    restaurant: {
      morning: 'Brunch time',
      afternoon: 'Lunch spot',
      evening: 'Dinner time',
    },
    bar: {
      evening: 'Happy hour vibes',
      night: 'Night out pick',
      late_night: 'Late night spot',
    },
    nightclub: {
      night: 'Time to go out',
      late_night: 'Peak nightlife',
    },
    music_venue: {
      evening: 'Show time',
      night: 'Live music tonight',
    },
    brewery: {
      afternoon: 'Afternoon brew',
      evening: 'Evening taproom',
    },
  }
  return labels[catKey]?.[tod] ?? 'Good time to visit'
}

/**
 * Get personalized trending: re-rank trending venues by user preferences.
 */
export function getPersonalizedTrending(
  user: User,
  venues: Venue[],
  pulses: Pulse[],
  userLocation?: { lat: number; lng: number },
  date?: Date,
  limit: number = 10
): Venue[] {
  const recs = getRecommendations(user, venues, pulses, userLocation, date, limit)
  return recs
    .filter(r => r.venue.pulseScore >= 30)
    .map(r => r.venue)
}
