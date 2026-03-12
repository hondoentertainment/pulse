import type { Venue, User, Pulse, EnergyRating, ENERGY_CONFIG } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoodType = 'chill' | 'wild' | 'date-night' | 'group-outing'

export interface PersonalizationContext {
  user: User
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  currentTime: Date
}

export interface ScoredVenue {
  venue: Venue
  personalScore: number
  reasons: string[]
  distance?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Haversine distance in miles between two lat/lng points. */
function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Clamp a number between 0 and 1. */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Get the day name from a Date. */
function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}

// ---------------------------------------------------------------------------
// Category time-of-day profiles (hour → 0-1 relevance)
// ---------------------------------------------------------------------------

const TIME_PROFILES: Record<string, (hour: number) => number> = {
  bar: (h) => (h >= 17 && h <= 23 ? 0.6 + 0.4 * ((h - 17) / 6) : h < 3 ? 0.8 : 0.1),
  nightclub: (h) => (h >= 21 || h < 4 ? 0.7 + 0.3 * Math.min(1, (h >= 21 ? h - 21 : h + 3) / 4) : 0.05),
  lounge: (h) => (h >= 18 && h <= 24 ? 0.7 : h < 2 ? 0.5 : 0.15),
  club: (h) => (h >= 22 || h < 4 ? 0.9 : 0.05),
  cafe: (h) => (h >= 6 && h <= 14 ? 0.5 + 0.5 * (1 - Math.abs(h - 10) / 4) : 0.15),
  coffee: (h) => (h >= 6 && h <= 14 ? 0.5 + 0.5 * (1 - Math.abs(h - 9) / 5) : 0.1),
  restaurant: (h) => {
    if (h >= 11 && h <= 14) return 0.7
    if (h >= 17 && h <= 22) return 0.9
    return 0.2
  },
  brewery: (h) => (h >= 14 && h <= 22 ? 0.5 + 0.5 * (1 - Math.abs(h - 18) / 4) : 0.1),
  rooftop: (h) => (h >= 16 && h <= 23 ? 0.6 + 0.4 * (1 - Math.abs(h - 20) / 4) : 0.1),
}

function getTimeRelevance(category: string | undefined, hour: number): number {
  if (!category) return 0.5
  const key = category.toLowerCase()
  for (const [k, fn] of Object.entries(TIME_PROFILES)) {
    if (key.includes(k)) return clamp01(fn(hour))
  }
  return 0.5
}

// ---------------------------------------------------------------------------
// Mood → category / energy mapping
// ---------------------------------------------------------------------------

const MOOD_CATEGORIES: Record<MoodType, string[]> = {
  chill: ['cafe', 'coffee', 'lounge', 'wine', 'jazz', 'tea', 'bookstore'],
  wild: ['nightclub', 'club', 'bar', 'rave', 'dance', 'brewery', 'pub'],
  'date-night': ['lounge', 'wine', 'restaurant', 'rooftop', 'jazz', 'cocktail', 'speakeasy'],
  'group-outing': ['bar', 'brewery', 'pub', 'arcade', 'karaoke', 'bowling', 'sports'],
}

const MOOD_ENERGY: Record<MoodType, EnergyRating[]> = {
  chill: ['chill'],
  wild: ['buzzing', 'electric'],
  'date-night': ['chill', 'buzzing'],
  'group-outing': ['buzzing', 'electric'],
}

// ---------------------------------------------------------------------------
// Scoring factors
// ---------------------------------------------------------------------------

const WEIGHTS = {
  categoryAffinity: 0.25,
  timeRelevance: 0.20,
  proximity: 0.20,
  socialSignal: 0.15,
  trendingMomentum: 0.10,
  novelty: 0.10,
} as const

function scoreCategoryAffinity(
  venue: Venue,
  user: User,
): { score: number; reason: string | null } {
  let score = 0
  let reason: string | null = null
  const cat = venue.category?.toLowerCase() ?? ''

  // Match against favoriteCategories
  if (user.favoriteCategories && user.favoriteCategories.length > 0) {
    const match = user.favoriteCategories.some((fc) =>
      cat.includes(fc.toLowerCase()) || fc.toLowerCase().includes(cat),
    )
    if (match) {
      score += 0.6
      reason = `Matches your taste in ${venue.category}`
    }
  }

  // Boost based on check-in frequency for this venue's category
  if (user.venueCheckInHistory) {
    const totalCheckins = Object.values(user.venueCheckInHistory).reduce(
      (a, b) => a + b,
      0,
    )
    const venueCheckins = user.venueCheckInHistory[venue.id] ?? 0
    if (totalCheckins > 0) {
      score += 0.4 * (venueCheckins / totalCheckins)
      if (venueCheckins > 2 && !reason) {
        reason = 'One of your go-to spots'
      }
    }
  }

  return { score: clamp01(score), reason }
}

function scoreTimeRelevance(
  venue: Venue,
  currentTime: Date,
): { score: number; reason: string | null } {
  const hour = currentTime.getHours()
  const score = getTimeRelevance(venue.category, hour)
  const dayName = getDayName(currentTime)
  let reason: string | null = null

  if (score > 0.7) {
    const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1)
    reason = `Perfect for ${dayLabel} ${hour >= 17 ? 'nights' : hour >= 12 ? 'afternoons' : 'mornings'}`
  }

  return { score, reason }
}

function scoreProximity(
  venue: Venue,
  userLocation: { lat: number; lng: number } | null,
): { score: number; reason: string | null; distance?: number } {
  if (!userLocation) return { score: 0.5, reason: null }

  const dist = haversineDistance(userLocation, {
    lat: venue.location.lat,
    lng: venue.location.lng,
  })

  // Decay: 1.0 at 0 miles, ~0 at 5+ miles
  const score = clamp01(1 - dist / 5)
  let reason: string | null = null
  if (dist < 0.5) reason = 'Just around the corner'
  else if (dist < 1) reason = 'Nearby'
  else if (dist < 2) reason = 'Trending near you'

  return { score, reason, distance: Math.round(dist * 10) / 10 }
}

function scoreSocialSignal(
  venue: Venue,
  user: User,
  pulses: Pulse[],
): { score: number; reason: string | null } {
  const friendIds = new Set(user.friends)
  if (friendIds.size === 0) return { score: 0, reason: null }

  const now = Date.now()
  const threeHoursAgo = now - 3 * 60 * 60 * 1000

  // Find recent friend pulses at this venue
  const friendPulses = pulses.filter(
    (p) =>
      p.venueId === venue.id &&
      friendIds.has(p.userId) &&
      new Date(p.createdAt).getTime() > threeHoursAgo,
  )

  const uniqueFriends = new Set(friendPulses.map((p) => p.userId)).size

  if (uniqueFriends === 0) return { score: 0, reason: null }

  const score = clamp01(uniqueFriends / 3) // 3+ friends = max score
  const reason =
    uniqueFriends === 1
      ? 'A friend is here right now'
      : `${uniqueFriends} friends are here`

  return { score, reason }
}

function scoreTrendingMomentum(
  venue: Venue,
): { score: number; reason: string | null } {
  let score = 0
  let reason: string | null = null

  // scoreVelocity is a rate of pulse-score change
  if (venue.scoreVelocity && venue.scoreVelocity > 0) {
    score = clamp01(venue.scoreVelocity / 10)
    if (score > 0.5) reason = 'Trending right now'
  }

  // Also consider raw pulse score
  const pulseBoost = clamp01(venue.pulseScore / 100)
  score = clamp01(score * 0.6 + pulseBoost * 0.4)

  if (venue.preTrending && !reason) {
    reason = venue.preTrendingLabel ?? 'About to trend'
  }

  return { score, reason }
}

function scoreNovelty(
  venue: Venue,
  user: User,
): { score: number; reason: string | null } {
  const visits = user.venueCheckInHistory?.[venue.id] ?? 0
  if (visits === 0) {
    return { score: 0.8, reason: 'New spot for you' }
  }
  // Diminishing novelty with repeat visits
  return { score: clamp01(0.3 / visits), reason: null }
}

// ---------------------------------------------------------------------------
// Main personalization function
// ---------------------------------------------------------------------------

export function getPersonalizedVenues(
  context: PersonalizationContext,
): ScoredVenue[] {
  const { user, venues, pulses, userLocation, currentTime } = context

  const scored: ScoredVenue[] = venues.map((venue) => {
    const reasons: string[] = []
    let totalScore = 0

    // 1. Category affinity
    const cat = scoreCategoryAffinity(venue, user)
    totalScore += WEIGHTS.categoryAffinity * cat.score
    if (cat.reason) reasons.push(cat.reason)

    // 2. Time relevance
    const time = scoreTimeRelevance(venue, currentTime)
    totalScore += WEIGHTS.timeRelevance * time.score
    if (time.reason) reasons.push(time.reason)

    // 3. Proximity
    const prox = scoreProximity(venue, userLocation)
    totalScore += WEIGHTS.proximity * prox.score
    if (prox.reason) reasons.push(prox.reason)

    // 4. Social signal
    const social = scoreSocialSignal(venue, user, pulses)
    totalScore += WEIGHTS.socialSignal * social.score
    if (social.reason) reasons.push(social.reason)

    // 5. Trending momentum
    const trending = scoreTrendingMomentum(venue)
    totalScore += WEIGHTS.trendingMomentum * trending.score
    if (trending.reason) reasons.push(trending.reason)

    // 6. Novelty
    const novelty = scoreNovelty(venue, user)
    totalScore += WEIGHTS.novelty * novelty.score
    if (novelty.reason) reasons.push(novelty.reason)

    return {
      venue,
      personalScore: Math.round(totalScore * 1000) / 1000,
      reasons: reasons.length > 0 ? reasons : ['Recommended for you'],
      distance: prox.distance,
    }
  })

  // Sort descending by score
  scored.sort((a, b) => b.personalScore - a.personalScore)

  return scored
}

// ---------------------------------------------------------------------------
// Human-readable recommendation reason
// ---------------------------------------------------------------------------

export function getVenueRecommendationReason(scored: ScoredVenue): string {
  if (scored.reasons.length === 0) return 'Recommended for you'

  // Prioritize social > trending > proximity > category > time
  const priority = [
    'friends',
    'Trending',
    'corner',
    'Nearby',
    'near you',
    'Matches',
    'go-to',
    'New spot',
    'Perfect for',
  ]

  for (const keyword of priority) {
    const match = scored.reasons.find((r) => r.includes(keyword))
    if (match) return match
  }

  return scored.reasons[0]
}

// ---------------------------------------------------------------------------
// Mood-based venue filtering
// ---------------------------------------------------------------------------

export function getMoodVenues(venues: Venue[], mood: MoodType): Venue[] {
  const categories = MOOD_CATEGORIES[mood]
  const energies = MOOD_ENERGY[mood]

  return venues
    .filter((venue) => {
      const cat = venue.category?.toLowerCase() ?? ''
      const categoryMatch = categories.some(
        (c) => cat.includes(c) || c.includes(cat),
      )
      return categoryMatch
    })
    .sort((a, b) => {
      // Prefer venues whose pulse score aligns with mood energy
      const aEnergy = pulseScoreToEnergy(a.pulseScore)
      const bEnergy = pulseScoreToEnergy(b.pulseScore)
      const aMatch = energies.includes(aEnergy) ? 1 : 0
      const bMatch = energies.includes(bEnergy) ? 1 : 0
      if (bMatch !== aMatch) return bMatch - aMatch
      return b.pulseScore - a.pulseScore
    })
}

function pulseScoreToEnergy(score: number): EnergyRating {
  if (score >= 75) return 'electric'
  if (score >= 50) return 'buzzing'
  if (score >= 25) return 'chill'
  return 'dead'
}
