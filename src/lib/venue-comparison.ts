import type { Venue } from './types'
import { calculateDistance, getEnergyLabel } from './pulse-engine'

// --- Types ---

export type TrendDirection = 'up' | 'down' | 'stable'

export type ComparisonPreference = 'energy' | 'proximity' | 'social' | 'price'

export type MetricWinner = 'a' | 'b' | 'tie'

export interface ComparisonMetric {
  winner: MetricWinner
  difference: string
}

export interface VenueComparisonData {
  venue: Venue
  pulseScore: number
  energyLabel: string
  trending: TrendDirection
  distance: number | null
  category: string
  crowdVibeTags: string[]
  estimatedWait: number | null
  friendsPresentCount: number
  priceLevel: number
  peakHours: string | null
}

export interface VenueComparisonResult {
  venueA: VenueComparisonData
  venueB: VenueComparisonData
  metrics: {
    energy: ComparisonMetric
    distance: ComparisonMetric
    crowd: ComparisonMetric
    friends: ComparisonMetric
    price: ComparisonMetric
    wait: ComparisonMetric
  }
}

export interface UserPreferences {
  favoriteCategories?: string[]
  preferredPriceLevel?: number
  preferredEnergy?: 'chill' | 'buzzing' | 'electric'
  maxDistance?: number
}

// --- Helpers ---

function inferTrendDirection(venue: Venue): TrendDirection {
  const velocity = venue.scoreVelocity ?? 0
  if (velocity > 5) return 'up'
  if (velocity < -5) return 'down'
  return 'stable'
}

function inferCrowdVibeTags(venue: Venue): string[] {
  const tags: string[] = []
  const score = venue.pulseScore

  if (score >= 75) tags.push('packed')
  else if (score >= 50) tags.push('lively')
  else if (score >= 25) tags.push('chill')
  else tags.push('quiet')

  if (venue.category) {
    const cat = venue.category.toLowerCase()
    if (cat.includes('club') || cat.includes('dance')) tags.push('dance')
    if (cat.includes('bar') || cat.includes('lounge')) tags.push('drinks')
    if (cat.includes('music') || cat.includes('concert')) tags.push('live music')
    if (cat.includes('restaurant') || cat.includes('food')) tags.push('dining')
    if (cat.includes('rooftop')) tags.push('rooftop')
    if (cat.includes('sport')) tags.push('sports')
  }

  return tags
}

function inferPriceLevel(venue: Venue): number {
  const cat = (venue.category ?? '').toLowerCase()
  if (cat.includes('club') || cat.includes('lounge')) return 3
  if (cat.includes('rooftop') || cat.includes('cocktail')) return 3
  if (cat.includes('bar') || cat.includes('pub')) return 2
  if (cat.includes('restaurant') || cat.includes('grill')) return 2
  if (cat.includes('dive') || cat.includes('cafe')) return 1
  return 2
}

function inferPeakHours(venue: Venue): string | null {
  const cat = (venue.category ?? '').toLowerCase()
  if (cat.includes('club') || cat.includes('dance')) return '11pm - 2am'
  if (cat.includes('bar') || cat.includes('lounge') || cat.includes('pub')) return '9pm - 12am'
  if (cat.includes('restaurant')) return '7pm - 10pm'
  if (cat.includes('cafe') || cat.includes('coffee')) return '8am - 11am'
  return null
}

function inferEstimatedWait(venue: Venue): number | null {
  const score = venue.pulseScore
  if (score >= 80) return 20
  if (score >= 60) return 10
  if (score >= 40) return 5
  return 0
}

function buildVenueComparisonData(
  venue: Venue,
  userLocation?: { lat: number; lng: number },
  friendsPresentCount: number = 0
): VenueComparisonData {
  const distance = userLocation
    ? calculateDistance(
        userLocation.lat,
        userLocation.lng,
        venue.location.lat,
        venue.location.lng
      )
    : null

  return {
    venue,
    pulseScore: venue.pulseScore,
    energyLabel: getEnergyLabel(venue.pulseScore),
    trending: inferTrendDirection(venue),
    distance,
    category: venue.category ?? 'Venue',
    crowdVibeTags: inferCrowdVibeTags(venue),
    estimatedWait: inferEstimatedWait(venue),
    friendsPresentCount,
    priceLevel: inferPriceLevel(venue),
    peakHours: inferPeakHours(venue),
  }
}

// --- Public API ---

/**
 * Format a comparison metric between two numeric-ish values.
 */
export function formatComparisonMetric(
  metricA: number | null,
  metricB: number | null
): ComparisonMetric {
  if (metricA === null && metricB === null) {
    return { winner: 'tie', difference: 'No data' }
  }
  if (metricA === null) {
    return { winner: 'b', difference: 'No data for first venue' }
  }
  if (metricB === null) {
    return { winner: 'a', difference: 'No data for second venue' }
  }
  if (metricA === metricB) {
    return { winner: 'tie', difference: 'Equal' }
  }
  const diff = Math.abs(metricA - metricB)
  if (metricA > metricB) {
    return { winner: 'a', difference: `+${diff}` }
  }
  return { winner: 'b', difference: `+${diff}` }
}

/**
 * Compare two venues across all key dimensions.
 */
export function compareVenues(
  venueA: Venue,
  venueB: Venue,
  userLocation?: { lat: number; lng: number },
  friendsAtA: number = 0,
  friendsAtB: number = 0
): VenueComparisonResult {
  const dataA = buildVenueComparisonData(venueA, userLocation, friendsAtA)
  const dataB = buildVenueComparisonData(venueB, userLocation, friendsAtB)

  // Energy: higher is better
  const energy = formatComparisonMetric(dataA.pulseScore, dataB.pulseScore)

  // Distance: lower is better, so flip the winner
  const distRaw = formatComparisonMetric(dataA.distance, dataB.distance)
  const distance: ComparisonMetric =
    distRaw.winner === 'a'
      ? { ...distRaw, winner: 'b' }
      : distRaw.winner === 'b'
        ? { ...distRaw, winner: 'a' }
        : distRaw

  // Crowd: compare tag count as a rough proxy
  const crowd = formatComparisonMetric(
    dataA.crowdVibeTags.length,
    dataB.crowdVibeTags.length
  )

  // Friends: higher is better
  const friends = formatComparisonMetric(
    dataA.friendsPresentCount,
    dataB.friendsPresentCount
  )

  // Price: lower is better, so flip
  const priceRaw = formatComparisonMetric(dataA.priceLevel, dataB.priceLevel)
  const price: ComparisonMetric =
    priceRaw.winner === 'a'
      ? { ...priceRaw, winner: 'b' }
      : priceRaw.winner === 'b'
        ? { ...priceRaw, winner: 'a' }
        : priceRaw

  // Wait: lower is better, so flip
  const waitRaw = formatComparisonMetric(dataA.estimatedWait, dataB.estimatedWait)
  const wait: ComparisonMetric =
    waitRaw.winner === 'a'
      ? { ...waitRaw, winner: 'b' }
      : waitRaw.winner === 'b'
        ? { ...waitRaw, winner: 'a' }
        : waitRaw

  return {
    venueA: dataA,
    venueB: dataB,
    metrics: { energy, distance, crowd, friends, price, wait },
  }
}

/**
 * Generate a human-readable verdict comparing two venues.
 */
export function getComparisonVerdict(result: VenueComparisonResult): string {
  const nameA = result.venueA.venue.name
  const nameB = result.venueB.venue.name

  const parts: string[] = []

  // Energy comparison
  if (result.metrics.energy.winner === 'a') {
    parts.push(`${nameA} is hotter right now`)
  } else if (result.metrics.energy.winner === 'b') {
    parts.push(`${nameB} is hotter right now`)
  } else {
    parts.push('Both have the same energy')
  }

  // Social comparison
  if (result.metrics.friends.winner === 'a') {
    parts.push(`but ${nameA} has more friends`)
  } else if (result.metrics.friends.winner === 'b') {
    parts.push(`but ${nameB} has more friends`)
  }

  // Price comparison as tiebreaker context
  if (parts.length < 2 && result.metrics.price.winner !== 'tie') {
    const cheaper = result.metrics.price.winner === 'a' ? nameA : nameB
    parts.push(`${cheaper} is easier on the wallet`)
  }

  return parts.join(' ') || `${nameA} and ${nameB} are evenly matched`
}

/**
 * Pick a winner based on a specific user priority.
 */
export function getWinner(
  result: VenueComparisonResult,
  preference: ComparisonPreference
): 'a' | 'b' | 'tie' {
  switch (preference) {
    case 'energy':
      return result.metrics.energy.winner
    case 'proximity':
      return result.metrics.distance.winner
    case 'social':
      return result.metrics.friends.winner
    case 'price':
      return result.metrics.price.winner
    default:
      return 'tie'
  }
}

/**
 * Calculate how well a venue matches user preferences (0-100).
 */
export function calculateMatchScore(
  venue: Venue,
  userPreferences: UserPreferences
): number {
  let score = 0
  let maxScore = 0

  // Category match (0-30)
  maxScore += 30
  if (
    userPreferences.favoriteCategories &&
    userPreferences.favoriteCategories.length > 0
  ) {
    const venueCategory = (venue.category ?? '').toLowerCase()
    const match = userPreferences.favoriteCategories.some(
      (cat) => venueCategory.includes(cat.toLowerCase())
    )
    if (match) score += 30
  } else {
    score += 15 // neutral if no preference
  }

  // Energy match (0-30)
  maxScore += 30
  if (userPreferences.preferredEnergy) {
    const energyLabel = getEnergyLabel(venue.pulseScore).toLowerCase()
    if (energyLabel === userPreferences.preferredEnergy) {
      score += 30
    } else {
      // Partial credit for adjacent energy levels
      const levels = ['dead', 'chill', 'buzzing', 'electric']
      const prefIdx = levels.indexOf(userPreferences.preferredEnergy)
      const venueIdx = levels.indexOf(energyLabel)
      const diff = Math.abs(prefIdx - venueIdx)
      if (diff === 1) score += 15
    }
  } else {
    score += 15
  }

  // Price match (0-20)
  maxScore += 20
  if (userPreferences.preferredPriceLevel !== undefined) {
    const venuePrice = inferPriceLevel(venue)
    const diff = Math.abs(venuePrice - userPreferences.preferredPriceLevel)
    if (diff === 0) score += 20
    else if (diff === 1) score += 10
  } else {
    score += 10
  }

  // Base activity score (0-20) — reward active venues
  maxScore += 20
  score += Math.round((venue.pulseScore / 100) * 20)

  return Math.round((score / maxScore) * 100)
}
