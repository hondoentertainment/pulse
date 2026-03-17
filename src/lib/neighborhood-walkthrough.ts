import type { Venue, EnergyRating } from './types'
import type { Neighborhood } from './neighborhood-scores'
import { calculateDistance } from './interactive-map'

/**
 * Neighborhood Heatmap Walkthrough — Core Engine
 *
 * Generates real-time bar crawl routes through hot neighborhoods.
 * Uses nearest-neighbor with energy-score weighting for route optimization.
 */

export type WalkthroughTheme = 'hottest' | 'cocktail-crawl' | 'dive-bars' | 'live-music' | 'foodie' | 'best-of'

export type WalkthroughDifficulty = 'easy' | 'moderate' | 'ambitious'

export interface WalkthroughStop {
  venue: Venue
  order: number
  walkTimeFromPrevious: number
  estimatedArrival: Date
  energyAtArrival: EnergyRating
  reason: string
}

export interface WalkthroughRoute {
  id: string
  neighborhood: string
  stops: WalkthroughStop[]
  totalWalkTime: number
  totalDistance: number
  venueCount: number
  theme: string
  difficulty: WalkthroughDifficulty
}

export interface GenerateWalkthroughParams {
  venues: Venue[]
  neighborhood: string
  userLocation: { lat: number; lng: number }
  theme?: WalkthroughTheme
  maxStops?: number
  maxWalkTime?: number
}

// Walking speed: 3 mph
const WALKING_SPEED_MPH = 3

// Theme-to-category mapping for filtering
const THEME_CATEGORIES: Record<WalkthroughTheme, string[]> = {
  'hottest': [],
  'cocktail-crawl': ['bar', 'cocktail_bar', 'lounge', 'wine_bar'],
  'dive-bars': ['dive_bar', 'bar'],
  'live-music': ['music_venue', 'bar', 'nightclub'],
  'foodie': ['restaurant', 'cafe', 'food_hall'],
  'best-of': [],
}

const THEME_LABELS: Record<WalkthroughTheme, string> = {
  'hottest': 'Hottest Spots',
  'cocktail-crawl': 'Cocktail Crawl',
  'dive-bars': 'Dive Bar Tour',
  'live-music': 'Live Music Trail',
  'foodie': 'Foodie Walk',
  'best-of': 'Best Of',
}

const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

/**
 * Calculate walking time in minutes between two lat/lng points.
 * Assumes 3 mph walking speed.
 */
export function calculateWalkTime(
  pointA: { lat: number; lng: number },
  pointB: { lat: number; lng: number }
): number {
  const distMiles = calculateDistance(pointA.lat, pointA.lng, pointB.lat, pointB.lng)
  return Math.round((distMiles / WALKING_SPEED_MPH) * 60)
}

/**
 * Predict energy score at estimated arrival time.
 * Uses current pulse score plus time-of-day heuristics.
 */
export function estimateArrivalEnergy(venue: Venue, arrivalTime: Date): EnergyRating {
  const hour = arrivalTime.getHours()
  const baseScore = venue.pulseScore

  // Time-of-day modifier
  let timeModifier = 0
  if (hour >= 22 || hour <= 2) {
    timeModifier = 15 // peak nightlife
  } else if (hour >= 20) {
    timeModifier = 10 // warming up
  } else if (hour >= 18) {
    timeModifier = 5 // happy hour
  } else if (hour >= 2 && hour <= 6) {
    timeModifier = -20 // winding down
  }

  const adjusted = Math.max(0, Math.min(100, baseScore + timeModifier))

  if (adjusted >= 75) return 'electric'
  if (adjusted >= 50) return 'buzzing'
  if (adjusted >= 25) return 'chill'
  return 'dead'
}

/**
 * Generate a descriptive string for the route.
 */
export function generateThemeDescription(route: WalkthroughRoute): string {
  const timeStr = route.totalWalkTime >= 60
    ? `${Math.floor(route.totalWalkTime / 60)}-hour`
    : `${route.totalWalkTime}-minute`

  const themeLabel = THEME_LABELS[route.theme as WalkthroughTheme] ?? route.theme
  return `A ${timeStr} ${themeLabel.toLowerCase()} through ${route.neighborhood} hitting ${route.venueCount} of tonight's hottest spots`
}

/**
 * Check which themes have enough venues (>=2) to be viable.
 */
export function getAvailableThemes(venues: Venue[], neighborhood: string): WalkthroughTheme[] {
  const themes: WalkthroughTheme[] = ['hottest', 'cocktail-crawl', 'dive-bars', 'live-music', 'foodie', 'best-of']

  return themes.filter(theme => {
    const filtered = filterVenuesByTheme(venues, theme)
    return filtered.length >= 2
  })
}

/**
 * Filter venues by theme category.
 */
function filterVenuesByTheme(venues: Venue[], theme: WalkthroughTheme): Venue[] {
  const categories = THEME_CATEGORIES[theme]

  // 'hottest' and 'best-of' include all venues
  if (categories.length === 0) return venues

  return venues.filter(v => {
    const cat = (v.category ?? '').toLowerCase().replace(/\s+/g, '_')
    return categories.some(c => cat.includes(c) || c.includes(cat))
  })
}

/**
 * Compute a combined score for route selection:
 * balances proximity with energy/pulse score.
 */
function computeStopScore(
  venue: Venue,
  fromLocation: { lat: number; lng: number },
  arrivalTime: Date
): number {
  const dist = calculateDistance(fromLocation.lat, fromLocation.lng, venue.location.lat, venue.location.lng)
  const walkMinutes = (dist / WALKING_SPEED_MPH) * 60

  // Energy score normalized to 0-100
  const energyScore = venue.pulseScore

  // Proximity penalty: penalize venues that are far away
  const proximityPenalty = walkMinutes * 2

  // Time-of-day boost
  const hour = arrivalTime.getHours()
  let timeBoost = 0
  if (hour >= 21 || hour <= 2) timeBoost = 10
  if (hour >= 22 || hour <= 1) timeBoost = 15

  // Velocity bonus: venues trending up get a boost
  const velocityBonus = (venue.scoreVelocity ?? 0) > 0 ? 10 : 0

  return energyScore + timeBoost + velocityBonus - proximityPenalty
}

/**
 * Determine route difficulty based on total walk time and stop count.
 */
function determineDifficulty(totalWalkTime: number, stopCount: number): WalkthroughDifficulty {
  if (totalWalkTime <= 30 && stopCount <= 3) return 'easy'
  if (totalWalkTime <= 60 && stopCount <= 5) return 'moderate'
  return 'ambitious'
}

/**
 * Generate an optimized walkthrough route.
 *
 * Uses nearest-neighbor with energy-score weighting: doesn't just pick the
 * closest venue, but the best nearby venue based on a combined score.
 */
export function generateWalkthrough(params: GenerateWalkthroughParams): WalkthroughRoute {
  const {
    venues,
    neighborhood,
    userLocation,
    theme = 'hottest',
    maxStops = 5,
    maxWalkTime = 90,
  } = params

  // Filter by theme
  const themeVenues = filterVenuesByTheme(venues, theme)

  // Sort by pulse score for initial ranking
  const sorted = [...themeVenues].sort((a, b) => b.pulseScore - a.pulseScore)

  const stops: WalkthroughStop[] = []
  const usedIds = new Set<string>()
  let currentLocation = { ...userLocation }
  let currentTime = new Date()
  let totalWalkTime = 0
  let totalDistance = 0

  for (let i = 0; i < Math.min(maxStops, sorted.length); i++) {
    // Score each remaining candidate
    const candidates = sorted
      .filter(v => !usedIds.has(v.id))
      .map(v => ({
        venue: v,
        score: computeStopScore(v, currentLocation, currentTime),
      }))
      .sort((a, b) => b.score - a.score)

    if (candidates.length === 0) break

    const pick = candidates[0]
    const walkTime = calculateWalkTime(currentLocation, pick.venue.location)

    // Check max walk time constraint
    if (totalWalkTime + walkTime > maxWalkTime && stops.length > 0) break

    const arrivalTime = new Date(currentTime.getTime() + walkTime * 60 * 1000)
    const dist = calculateDistance(
      currentLocation.lat, currentLocation.lng,
      pick.venue.location.lat, pick.venue.location.lng
    )

    const energyAtArrival = estimateArrivalEnergy(pick.venue, arrivalTime)
    const reason = generateStopReason(pick.venue, energyAtArrival, theme)

    const isFirstStop = stops.length === 0

    stops.push({
      venue: pick.venue,
      order: stops.length + 1,
      walkTimeFromPrevious: isFirstStop ? 0 : walkTime,
      estimatedArrival: arrivalTime,
      energyAtArrival,
      reason,
    })

    usedIds.add(pick.venue.id)
    if (!isFirstStop) {
      totalWalkTime += walkTime
      totalDistance += dist
    }
    currentLocation = { lat: pick.venue.location.lat, lng: pick.venue.location.lng }

    // Add ~30 min dwell time at each venue
    currentTime = new Date(arrivalTime.getTime() + 30 * 60 * 1000)
  }

  return {
    id: `walk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    neighborhood,
    stops,
    totalWalkTime,
    totalDistance: Math.round(totalDistance * 100) / 100,
    venueCount: stops.length,
    theme,
    difficulty: determineDifficulty(totalWalkTime, stops.length),
  }
}

/**
 * Generate a human-readable reason for why this stop was chosen.
 */
function generateStopReason(venue: Venue, energy: EnergyRating, theme: WalkthroughTheme): string {
  const energyLabel = ENERGY_VALUES[energy] >= 2 ? 'buzzing' : 'warming up'

  if (theme === 'hottest') {
    return `${venue.name} is ${energyLabel} with a pulse score of ${venue.pulseScore}`
  }
  if (theme === 'cocktail-crawl') {
    return `Known for craft cocktails, currently ${energyLabel}`
  }
  if (theme === 'dive-bars') {
    return `Classic dive vibes, ${energyLabel} right now`
  }
  if (theme === 'live-music') {
    return `Live music venue, ${energyLabel} tonight`
  }
  if (theme === 'foodie') {
    return `Top-rated food spot, ${energyLabel} atmosphere`
  }
  return `One of the best in ${venue.city ?? 'the area'}, currently ${energyLabel}`
}

/**
 * Reorder route starting from a specific venue.
 * The specified venue becomes stop 1, then nearest-neighbor from there.
 */
export function reorderRoute(route: WalkthroughRoute, startVenueId: string): WalkthroughRoute {
  const startStop = route.stops.find(s => s.venue.id === startVenueId)
  if (!startStop) return route

  const remaining = route.stops.filter(s => s.venue.id !== startVenueId)
  const reordered: WalkthroughStop[] = [
    { ...startStop, order: 1, walkTimeFromPrevious: 0 },
  ]

  let currentLocation = {
    lat: startStop.venue.location.lat,
    lng: startStop.venue.location.lng,
  }
  let currentTime = new Date(startStop.estimatedArrival)
  let totalWalkTime = 0
  let totalDistance = 0

  const available = [...remaining]
  while (available.length > 0) {
    // Pick nearest by walk time
    let bestIdx = 0
    let bestTime = Infinity
    for (let i = 0; i < available.length; i++) {
      const wt = calculateWalkTime(currentLocation, available[i].venue.location)
      if (wt < bestTime) {
        bestTime = wt
        bestIdx = i
      }
    }

    const pick = available.splice(bestIdx, 1)[0]
    const walkTime = bestTime
    const dist = calculateDistance(
      currentLocation.lat, currentLocation.lng,
      pick.venue.location.lat, pick.venue.location.lng
    )
    const arrivalTime = new Date(currentTime.getTime() + walkTime * 60 * 1000 + 30 * 60 * 1000)

    reordered.push({
      ...pick,
      order: reordered.length + 1,
      walkTimeFromPrevious: walkTime,
      estimatedArrival: arrivalTime,
      energyAtArrival: estimateArrivalEnergy(pick.venue, arrivalTime),
    })

    totalWalkTime += walkTime
    totalDistance += dist
    currentLocation = { lat: pick.venue.location.lat, lng: pick.venue.location.lng }
    currentTime = arrivalTime
  }

  return {
    ...route,
    stops: reordered,
    totalWalkTime,
    totalDistance: Math.round(totalDistance * 100) / 100,
  }
}

/**
 * Add a venue stop to the route at the optimal position (minimizing total walk time).
 */
export function addStopToRoute(route: WalkthroughRoute, venue: Venue): WalkthroughRoute {
  if (route.stops.length === 0) {
    const now = new Date()
    const stop: WalkthroughStop = {
      venue,
      order: 1,
      walkTimeFromPrevious: 0,
      estimatedArrival: now,
      energyAtArrival: estimateArrivalEnergy(venue, now),
      reason: `Added ${venue.name} to the route`,
    }
    return {
      ...route,
      stops: [stop],
      venueCount: 1,
      totalWalkTime: 0,
      totalDistance: 0,
    }
  }

  // Find the best insertion point that minimizes added walk time
  let bestPosition = route.stops.length
  let bestAddedTime = Infinity

  for (let i = 0; i <= route.stops.length; i++) {
    const prev = i > 0 ? route.stops[i - 1].venue.location : null
    const next = i < route.stops.length ? route.stops[i].venue.location : null

    let addedTime = 0
    if (prev) {
      addedTime += calculateWalkTime(prev, venue.location)
    }
    if (next) {
      addedTime += calculateWalkTime(venue.location, next)
    }
    // Subtract the existing walk time between prev and next if both exist
    if (prev && next) {
      addedTime -= calculateWalkTime(prev, next)
    }

    if (addedTime < bestAddedTime) {
      bestAddedTime = addedTime
      bestPosition = i
    }
  }

  // Insert the new stop
  const newStops = [...route.stops]
  const prevStop = bestPosition > 0 ? newStops[bestPosition - 1] : null
  const prevLocation = prevStop ? prevStop.venue.location : venue.location
  const walkTime = prevStop ? calculateWalkTime(prevLocation, venue.location) : 0
  const arrivalTime = prevStop
    ? new Date(prevStop.estimatedArrival.getTime() + 30 * 60 * 1000 + walkTime * 60 * 1000)
    : new Date()

  const newStop: WalkthroughStop = {
    venue,
    order: bestPosition + 1,
    walkTimeFromPrevious: walkTime,
    estimatedArrival: arrivalTime,
    energyAtArrival: estimateArrivalEnergy(venue, arrivalTime),
    reason: `Added ${venue.name} to the route`,
  }

  newStops.splice(bestPosition, 0, newStop)

  // Recalculate subsequent stops
  return recalculateRoute(route, newStops)
}

/**
 * Remove a stop from the route and recalculate times.
 */
export function removeStopFromRoute(route: WalkthroughRoute, venueId: string): WalkthroughRoute {
  const newStops = route.stops.filter(s => s.venue.id !== venueId)
  if (newStops.length === route.stops.length) return route

  return recalculateRoute(route, newStops)
}

/**
 * Recalculate all times, distances, and ordering for a set of stops.
 */
function recalculateRoute(route: WalkthroughRoute, stops: WalkthroughStop[]): WalkthroughRoute {
  if (stops.length === 0) {
    return { ...route, stops: [], totalWalkTime: 0, totalDistance: 0, venueCount: 0 }
  }

  let totalWalkTime = 0
  let totalDistance = 0
  let currentTime = stops[0].estimatedArrival

  const recalculated = stops.map((stop, i) => {
    if (i === 0) {
      return { ...stop, order: 1, walkTimeFromPrevious: 0 }
    }

    const prev = stops[i - 1]
    const walkTime = calculateWalkTime(prev.venue.location, stop.venue.location)
    const dist = calculateDistance(
      prev.venue.location.lat, prev.venue.location.lng,
      stop.venue.location.lat, stop.venue.location.lng
    )
    const arrival = new Date(currentTime.getTime() + 30 * 60 * 1000 + walkTime * 60 * 1000)

    totalWalkTime += walkTime
    totalDistance += dist
    currentTime = arrival

    return {
      ...stop,
      order: i + 1,
      walkTimeFromPrevious: walkTime,
      estimatedArrival: arrival,
      energyAtArrival: estimateArrivalEnergy(stop.venue, arrival),
    }
  })

  return {
    ...route,
    stops: recalculated,
    totalWalkTime,
    totalDistance: Math.round(totalDistance * 100) / 100,
    venueCount: recalculated.length,
    difficulty: determineDifficulty(totalWalkTime, recalculated.length),
  }
}
