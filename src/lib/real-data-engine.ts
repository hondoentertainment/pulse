import { Venue } from './types'

/**
 * Time-aware venue data engine that generates realistic, dynamic pulse scores
 * based on venue type, day of week, time of day, and organic noise.
 *
 * No API keys needed — uses deterministic-seeded randomness so the same venue
 * at the same minute always returns the same score, but scores shift naturally
 * over time like a real nightlife scene.
 */

// Deterministic hash for consistent per-venue randomness
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

// Seeded pseudo-random (mulberry32)
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Category-based peak hour profiles (24h format, 0-1 multiplier)
interface HourProfile {
  peakHours: number[]      // Hours with highest activity
  shoulderHours: number[]  // Hours with moderate activity
  baseActivity: number     // Minimum activity level (0-1)
  peakMultiplier: number   // Maximum activity level (0-1)
  weekendBoost: number     // Friday/Saturday multiplier
}

const CATEGORY_PROFILES: Record<string, HourProfile> = {
  'Nightclub': {
    peakHours: [23, 0, 1, 2],
    shoulderHours: [22, 3, 21],
    baseActivity: 0.0,
    peakMultiplier: 1.0,
    weekendBoost: 1.4,
  },
  'Dance Club': {
    peakHours: [23, 0, 1, 2],
    shoulderHours: [22, 3, 21],
    baseActivity: 0.0,
    peakMultiplier: 0.95,
    weekendBoost: 1.35,
  },
  'Bar': {
    peakHours: [21, 22, 23, 0],
    shoulderHours: [19, 20, 1, 18],
    baseActivity: 0.05,
    peakMultiplier: 0.85,
    weekendBoost: 1.3,
  },
  'Lounge': {
    peakHours: [20, 21, 22, 23],
    shoulderHours: [19, 0, 18],
    baseActivity: 0.05,
    peakMultiplier: 0.80,
    weekendBoost: 1.25,
  },
  'Music Venue': {
    peakHours: [21, 22, 23],
    shoulderHours: [20, 0, 19],
    baseActivity: 0.0,
    peakMultiplier: 0.92,
    weekendBoost: 1.3,
  },
  'Brewery': {
    peakHours: [17, 18, 19, 20],
    shoulderHours: [15, 16, 21, 14],
    baseActivity: 0.1,
    peakMultiplier: 0.75,
    weekendBoost: 1.2,
  },
  'Café': {
    peakHours: [8, 9, 10, 11],
    shoulderHours: [7, 12, 13, 14, 15],
    baseActivity: 0.05,
    peakMultiplier: 0.55,
    weekendBoost: 1.1,
  },
  'Restaurant': {
    peakHours: [19, 20, 21],
    shoulderHours: [12, 13, 18, 22],
    baseActivity: 0.05,
    peakMultiplier: 0.70,
    weekendBoost: 1.2,
  },
  'Gallery': {
    peakHours: [18, 19, 20],
    shoulderHours: [14, 15, 16, 17, 21],
    baseActivity: 0.02,
    peakMultiplier: 0.50,
    weekendBoost: 1.15,
  },
}

const DEFAULT_PROFILE: HourProfile = {
  peakHours: [21, 22, 23, 0],
  shoulderHours: [19, 20, 1, 18],
  baseActivity: 0.05,
  peakMultiplier: 0.80,
  weekendBoost: 1.25,
}

function getProfile(category?: string): HourProfile {
  if (!category) return DEFAULT_PROFILE
  // Try exact match, then check if category contains a known key
  if (CATEGORY_PROFILES[category]) return CATEGORY_PROFILES[category]
  const lower = category.toLowerCase()
  if (lower.includes('club') || lower.includes('nightlife')) return CATEGORY_PROFILES['Nightclub']
  if (lower.includes('bar') || lower.includes('pub') || lower.includes('tavern')) return CATEGORY_PROFILES['Bar']
  if (lower.includes('music') || lower.includes('concert')) return CATEGORY_PROFILES['Music Venue']
  if (lower.includes('brew')) return CATEGORY_PROFILES['Brewery']
  if (lower.includes('caf') || lower.includes('coffee')) return CATEGORY_PROFILES['Café']
  if (lower.includes('restaurant') || lower.includes('food')) return CATEGORY_PROFILES['Restaurant']
  if (lower.includes('lounge')) return CATEGORY_PROFILES['Lounge']
  if (lower.includes('gallery') || lower.includes('art')) return CATEGORY_PROFILES['Gallery']
  return DEFAULT_PROFILE
}

// Timezone offsets for major cities (hours from UTC)
const CITY_TIMEZONE_OFFSETS: Record<string, number> = {
  // US cities
  'Seattle': -7, 'Portland': -7, 'San Francisco': -7, 'Los Angeles': -7,
  'Las Vegas': -7, 'Phoenix': -7, 'Salt Lake City': -6, 'Denver': -6,
  'Austin': -5, 'Dallas': -5, 'Houston': -5, 'San Antonio': -5,
  'Kansas City': -5, 'Chicago': -5, 'Milwaukee': -5, 'Columbus': -4,
  'Detroit': -4, 'Nashville': -5, 'Charlotte': -4, 'Atlanta': -4,
  'Tampa': -4, 'Miami': -4, 'Orlando': -4, 'Pittsburgh': -4,
  'Philadelphia': -4, 'New York': -4, 'Washington DC': -4, 'Boston': -4,
  'New Orleans': -5, 'Minneapolis': -5, 'Honolulu': -10, 'Anchorage': -8,
  // International
  'London': 0, 'Berlin': 1, 'Amsterdam': 1, 'Barcelona': 1,
  'Tokyo': 9, 'Seoul': 9, 'Bangkok': 7, 'Dubai': 4,
  'Sydney': 11, 'Toronto': -4, 'Mexico City': -5, 'Buenos Aires': -3,
}

function getLocalHour(now: Date, city?: string): number {
  // Get UTC hour, then apply city offset
  const utcHour = now.getUTCHours()
  const utcMinutes = now.getUTCMinutes()
  const offset = city ? (CITY_TIMEZONE_OFFSETS[city] ?? -7) : -(now.getTimezoneOffset() / 60)
  const localHour = ((utcHour + offset + 24) % 24) + (utcMinutes / 60)
  return localHour
}

function getTimeMultiplier(hour: number, profile: HourProfile): number {
  const intHour = Math.floor(hour) % 24

  if (profile.peakHours.includes(intHour)) {
    return profile.peakMultiplier
  }
  if (profile.shoulderHours.includes(intHour)) {
    // Smooth transition: 60-80% of peak
    return profile.peakMultiplier * 0.6
  }
  return profile.baseActivity
}

function getDayMultiplier(now: Date, city?: string): number {
  // Adjust day based on local time too
  const utcDay = now.getUTCDay()
  const offset = city ? (CITY_TIMEZONE_OFFSETS[city] ?? -7) : -(now.getTimezoneOffset() / 60)
  const localHour = (now.getUTCHours() + offset + 24) % 24
  // If past midnight with positive offset, it might be next day
  let day = utcDay
  if (now.getUTCHours() + offset >= 24) day = (day + 1) % 7
  if (now.getUTCHours() + offset < 0) day = (day + 6) % 7

  // 0=Sun, 1=Mon... 5=Fri, 6=Sat
  if (day === 5 || day === 6) return 1.0  // Fri/Sat peak
  if (day === 4) return 0.85              // Thursday
  if (day === 0) return 0.7               // Sunday
  return 0.6                               // Mon-Wed
}

/**
 * Calculate a realistic pulse score for a venue at the current time.
 * Returns 0-100.
 */
export function calculateRealisticPulseScore(venue: Venue, now: Date): number {
  const profile = getProfile(venue.category)
  const localHour = getLocalHour(now, venue.city)
  const dayMult = getDayMultiplier(now, venue.city)

  // Time-based activity level
  let activity = getTimeMultiplier(localHour, profile)

  // Weekend boost
  const utcDay = now.getUTCDay()
  if (utcDay === 5 || utcDay === 6) {
    activity *= profile.weekendBoost
  }

  // Day-of-week scaling
  activity *= dayMult

  // Per-venue organic noise — changes every 5 minutes
  const fiveMinSlot = Math.floor(now.getTime() / (5 * 60 * 1000))
  const venueHash = hashCode(venue.id)
  const rng = seededRandom(venueHash + fiveMinSlot)
  const noise = (rng() - 0.5) * 0.3 // ±15% noise

  // "Popularity" factor: derived from venue name hash for consistent venue personality
  const popularityRng = seededRandom(venueHash)
  const popularity = 0.6 + popularityRng() * 0.4 // 0.6-1.0

  // Combine
  let score = activity * popularity * 100 + noise * 100
  score = Math.max(0, Math.min(100, Math.round(score)))

  return score
}

/**
 * Determine if a venue is currently "trending" (rapid score increase).
 */
export function isVenueTrending(venue: Venue, now: Date): boolean {
  const current = calculateRealisticPulseScore(venue, now)
  // Check score from 15 min ago
  const past = calculateRealisticPulseScore(venue, new Date(now.getTime() - 15 * 60 * 1000))
  return current - past > 15 && current > 50
}

/**
 * Calculate score velocity (change per hour).
 */
export function calculateVelocity(venue: Venue, now: Date): number {
  const current = calculateRealisticPulseScore(venue, now)
  const past = calculateRealisticPulseScore(venue, new Date(now.getTime() - 30 * 60 * 1000))
  return (current - past) * 2 // Extrapolate to per-hour
}

/**
 * Get simulated check-in count based on pulse score and venue capacity.
 */
export function getSimulatedCheckIns(venue: Venue, now: Date): number {
  const score = calculateRealisticPulseScore(venue, now)
  const venueHash = hashCode(venue.id)
  const rng = seededRandom(venueHash + 999)
  // Capacity estimate by category
  const capacities: Record<string, number> = {
    'Nightclub': 400, 'Dance Club': 300, 'Bar': 120, 'Lounge': 80,
    'Music Venue': 500, 'Brewery': 150, 'Café': 50, 'Restaurant': 100,
    'Gallery': 60,
  }
  const capacity = capacities[venue.category ?? ''] ?? 100
  const capacityVariance = 0.7 + rng() * 0.6 // 70-130% of base capacity
  const effectiveCapacity = capacity * capacityVariance

  // Check-ins = fraction of capacity based on pulse score
  const occupancy = (score / 100) * 0.8 // Max 80% of capacity at score 100
  return Math.round(effectiveCapacity * occupancy)
}

/**
 * Get a realistic "last activity" timestamp.
 */
export function getLastActivity(venue: Venue, now: Date): string {
  const score = calculateRealisticPulseScore(venue, now)
  if (score === 0) {
    // Random time 2-8 hours ago
    const hoursAgo = 2 + (hashCode(venue.id) % 6)
    return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString()
  }
  // Active venues: 1-15 minutes ago based on score
  const minutesAgo = Math.max(1, Math.round(15 * (1 - score / 100)))
  return new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString()
}

/**
 * Enrich all venues with real-time dynamic data.
 * Call this on an interval to update venue scores dynamically.
 */
export function enrichVenuesWithRealtimeData(venues: Venue[], now: Date): Venue[] {
  return venues.map(venue => {
    const pulseScore = calculateRealisticPulseScore(venue, now)
    const velocity = calculateVelocity(venue, now)
    const trending = isVenueTrending(venue, now)
    const checkIns = getSimulatedCheckIns(venue, now)
    const lastActivity = getLastActivity(venue, now)

    return {
      ...venue,
      pulseScore,
      scoreVelocity: velocity,
      preTrending: trending,
      verifiedCheckInCount: checkIns,
      lastActivity,
      lastPulseAt: pulseScore > 0 ? lastActivity : venue.lastPulseAt,
    }
  })
}

/**
 * Get the top trending venues for a city right now.
 */
export function getTrendingVenues(venues: Venue[], city: string, now: Date, limit = 10): Venue[] {
  const cityVenues = venues.filter(v => v.city === city)
  const enriched = enrichVenuesWithRealtimeData(cityVenues, now)
  return enriched
    .sort((a, b) => (b.scoreVelocity ?? 0) - (a.scoreVelocity ?? 0))
    .slice(0, limit)
}

/**
 * Generate realistic "stories" data for active venues.
 */
export function getActiveVenueCount(venues: Venue[], now: Date): number {
  return venues.filter(v => calculateRealisticPulseScore(v, now) > 20).length
}
