import type { Venue, Pulse, User, EnergyRating } from './types'
import { getRecommendations } from './venue-recommendations'
import { analyzeVenuePatterns, predictSurge } from './predictive-surge'
import { generateRideshareLink } from './integrations'
import type { Crew } from './crew-mode'

/**
 * AI Night Planner — Multi-stop itinerary engine
 *
 * Generates optimized night plans based on group size, budget, preferences,
 * location, and time constraints. Integrates venue recommendations, surge
 * predictions, and transit estimation.
 */

export type StopPurpose = 'dinner' | 'drinks' | 'dancing' | 'latenight'

export type TransitMode = 'walk' | 'rideshare' | 'transit'

export type PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface PlanPreferences {
  vibes: string[]
  musicGenres: string[]
  venueTypes: string[]
  avoidCategories: string[]
}

export interface PlanBudget {
  total: number
  perPerson: number
}

export interface PlanStop {
  venueId: string
  venueName: string
  venueCategory?: string
  venueLocation?: { lat: number; lng: number; address: string }
  arrivalTime: string
  departureTime: string
  purpose: StopPurpose
  estimatedSpend: number
  transitMode: TransitMode
  transitDuration: number
  transitDeepLink?: string
  energyPrediction: EnergyRating
  locked?: boolean
}

export interface NightPlan {
  id: string
  crewId?: string
  date: string
  budget: PlanBudget
  preferences: PlanPreferences
  stops: PlanStop[]
  status: PlanStatus
  createdBy: string
  groupSize: number
  startTime: string
  endTime: string
  createdAt: string
}

export interface GeneratePlanParams {
  groupSize: number
  budget: number
  preferences: PlanPreferences
  location: { lat: number; lng: number }
  startTime: string
  endTime: string
  userId: string
  crewId?: string
  lockedStops?: PlanStop[]
}

// Budget allocation percentages by stop purpose
const BUDGET_ALLOCATION: Record<StopPurpose, number> = {
  dinner: 0.40,
  drinks: 0.30,
  dancing: 0.20,
  latenight: 0.10,
}

// Stop purpose progression for a typical night out
const PURPOSE_PROGRESSION: StopPurpose[] = ['dinner', 'drinks', 'dancing', 'latenight']

// Category mapping for venue types to stop purposes
const CATEGORY_PURPOSE_MAP: Record<string, StopPurpose> = {
  restaurant: 'dinner',
  cafe: 'dinner',
  bar: 'drinks',
  brewery: 'drinks',
  wine_bar: 'drinks',
  cocktail_bar: 'drinks',
  nightclub: 'dancing',
  music_venue: 'dancing',
  lounge: 'latenight',
  dive_bar: 'latenight',
}

// Vibe to venue category mapping
const VIBE_CATEGORY_MAP: Record<string, string[]> = {
  chill: ['lounge', 'wine_bar', 'brewery', 'cafe'],
  wild: ['nightclub', 'bar', 'music_venue'],
  classy: ['cocktail_bar', 'wine_bar', 'restaurant', 'lounge'],
  underground: ['dive_bar', 'music_venue', 'bar'],
  'date night': ['restaurant', 'cocktail_bar', 'wine_bar', 'lounge'],
  birthday: ['nightclub', 'bar', 'restaurant', 'karaoke'],
  lowkey: ['brewery', 'lounge', 'cafe', 'bar'],
  rooftop: ['bar', 'lounge', 'restaurant'],
}

/**
 * Generate an optimized night plan.
 */
export function generateNightPlan(
  params: GeneratePlanParams,
  venues: Venue[],
  pulses: Pulse[],
  user: User
): NightPlan {
  const {
    groupSize,
    budget,
    preferences,
    location,
    startTime,
    endTime,
    userId,
    crewId,
    lockedStops,
  } = params

  const perPerson = budget
  const totalBudget = perPerson * groupSize

  // Determine how many stops based on time window
  const startMs = new Date(startTime).getTime()
  const endMs = new Date(endTime).getTime()
  const totalHours = (endMs - startMs) / (1000 * 60 * 60)
  const numStops = Math.max(2, Math.min(4, Math.floor(totalHours / 1.5)))

  // Determine which purposes to include
  const purposes = selectPurposes(numStops, startTime)

  // Get venue recommendations
  const recs = getRecommendations(user, venues, pulses, location, new Date(startTime), 50)

  // Filter venues by preferences
  const filteredVenues = filterByPreferences(recs.map(r => r.venue), preferences)

  // Select venues for each stop purpose, respecting locked stops
  const selectedVenues = selectVenuesForStops(
    filteredVenues,
    purposes,
    location,
    lockedStops
  )

  // Calculate time windows for each stop
  const timeWindows = calculateTimeWindows(startMs, endMs, selectedVenues.length)

  // Get energy predictions
  const startDate = new Date(startTime)
  const dayOfWeek = startDate.getDay()

  // Allocate budget
  const budgetAllocation = allocateBudget(perPerson, purposes)

  // Build stops
  const stops: PlanStop[] = selectedVenues.map((venue, i) => {
    const purpose = purposes[i]
    const [arrivalMs, departureMs] = timeWindows[i]
    const arrivalHour = new Date(arrivalMs).getHours()

    // Check if this stop is locked
    const lockedStop = lockedStops?.find(ls => ls.venueId === venue.id)
    if (lockedStop) {
      return { ...lockedStop, locked: true }
    }

    // Energy prediction
    const patterns = analyzeVenuePatterns(venue.id, pulses)
    const prediction = predictSurge(venue.id, patterns, arrivalHour, dayOfWeek)

    // Transit from previous stop or user location
    const fromLocation = i === 0
      ? location
      : { lat: selectedVenues[i - 1].location.lat, lng: selectedVenues[i - 1].location.lng }
    const transit = estimateTransit(
      fromLocation,
      { lat: venue.location.lat, lng: venue.location.lng },
      venue
    )

    return {
      venueId: venue.id,
      venueName: venue.name,
      venueCategory: venue.category,
      venueLocation: venue.location,
      arrivalTime: new Date(arrivalMs).toISOString(),
      departureTime: new Date(departureMs).toISOString(),
      purpose,
      estimatedSpend: budgetAllocation[i],
      transitMode: transit.mode,
      transitDuration: transit.duration,
      transitDeepLink: transit.deepLink,
      energyPrediction: prediction.predictedEnergyLevel,
    }
  })

  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    crewId,
    date: startDate.toISOString().split('T')[0],
    budget: { total: totalBudget, perPerson },
    preferences,
    stops,
    status: 'draft',
    createdBy: userId,
    groupSize,
    startTime,
    endTime,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Select stop purposes based on number of stops and start time.
 */
function selectPurposes(numStops: number, startTime: string): StopPurpose[] {
  const startHour = new Date(startTime).getHours()

  // If starting late (after 10pm), skip dinner
  if (startHour >= 22) {
    return PURPOSE_PROGRESSION.slice(-numStops)
  }

  // If starting after dinner time (after 9pm), skip dinner
  if (startHour >= 21) {
    const latePurposes: StopPurpose[] = ['drinks', 'dancing', 'latenight']
    return latePurposes.slice(0, numStops)
  }

  // Normal progression
  return PURPOSE_PROGRESSION.slice(0, numStops)
}

/**
 * Filter venues by user preferences.
 */
function filterByPreferences(venues: Venue[], preferences: PlanPreferences): Venue[] {
  const avoidSet = new Set(preferences.avoidCategories.map(c => c.toLowerCase()))

  let filtered = venues.filter(v => {
    const cat = (v.category ?? '').toLowerCase()
    return !avoidSet.has(cat)
  })

  // Boost venues matching preferred vibes
  if (preferences.vibes.length > 0) {
    const preferredCategories = new Set<string>()
    for (const vibe of preferences.vibes) {
      const cats = VIBE_CATEGORY_MAP[vibe.toLowerCase()] ?? []
      cats.forEach(c => preferredCategories.add(c))
    }

    if (preferredCategories.size > 0) {
      // Sort preferred categories first, but keep all venues
      filtered.sort((a, b) => {
        const aMatch = preferredCategories.has((a.category ?? '').toLowerCase()) ? 1 : 0
        const bMatch = preferredCategories.has((b.category ?? '').toLowerCase()) ? 1 : 0
        return bMatch - aMatch
      })
    }
  }

  // Boost venues matching venue types preference
  if (preferences.venueTypes.length > 0) {
    const typeSet = new Set(preferences.venueTypes.map(t => t.toLowerCase()))
    filtered.sort((a, b) => {
      const aMatch = typeSet.has((a.category ?? '').toLowerCase()) ? 1 : 0
      const bMatch = typeSet.has((b.category ?? '').toLowerCase()) ? 1 : 0
      return bMatch - aMatch
    })
  }

  return filtered
}

/**
 * Select venues for each stop, matching purpose and avoiding repeats.
 * Uses nearest-neighbor TSP approximation for route optimization.
 */
function selectVenuesForStops(
  venues: Venue[],
  purposes: StopPurpose[],
  startLocation: { lat: number; lng: number },
  lockedStops?: PlanStop[]
): Venue[] {
  const selected: Venue[] = []
  const usedIds = new Set<string>()
  const lockedVenueIds = new Set(lockedStops?.map(ls => ls.venueId) ?? [])

  // Place locked stops first
  for (let i = 0; i < purposes.length; i++) {
    const locked = lockedStops?.find(ls => ls.purpose === purposes[i])
    if (locked) {
      const venue = venues.find(v => v.id === locked.venueId)
      if (venue) {
        selected[i] = venue
        usedIds.add(venue.id)
      }
    }
  }

  // Fill remaining stops with nearest-neighbor approach
  let currentLat = startLocation.lat
  let currentLng = startLocation.lng

  for (let i = 0; i < purposes.length; i++) {
    if (selected[i]) {
      currentLat = selected[i].location.lat
      currentLng = selected[i].location.lng
      continue
    }

    const purpose = purposes[i]

    // Find venues suitable for this purpose
    const candidates = venues.filter(v => {
      if (usedIds.has(v.id)) return false
      if (lockedVenueIds.has(v.id)) return false
      const cat = (v.category ?? '').toLowerCase()
      const mappedPurpose = CATEGORY_PURPOSE_MAP[cat]
      // Accept venue if its category maps to this purpose, or if no mapping exists
      return mappedPurpose === purpose || !mappedPurpose
    })

    if (candidates.length === 0) {
      // Fallback: pick any unused venue, nearest first
      const fallback = venues
        .filter(v => !usedIds.has(v.id) && !lockedVenueIds.has(v.id))
        .sort((a, b) => {
          const distA = haversine(currentLat, currentLng, a.location.lat, a.location.lng)
          const distB = haversine(currentLat, currentLng, b.location.lat, b.location.lng)
          return distA - distB
        })

      if (fallback.length > 0) {
        selected[i] = fallback[0]
        usedIds.add(fallback[0].id)
        currentLat = fallback[0].location.lat
        currentLng = fallback[0].location.lng
      }
      continue
    }

    // Pick nearest candidate (nearest-neighbor TSP approximation)
    candidates.sort((a, b) => {
      const distA = haversine(currentLat, currentLng, a.location.lat, a.location.lng)
      const distB = haversine(currentLat, currentLng, b.location.lat, b.location.lng)
      return distA - distB
    })

    // Pick from top 3 nearest to add some variety
    const pick = candidates[0]
    selected[i] = pick
    usedIds.add(pick.id)
    currentLat = pick.location.lat
    currentLng = pick.location.lng
  }

  return selected.filter(Boolean)
}

/**
 * Calculate time windows for each stop.
 */
function calculateTimeWindows(
  startMs: number,
  endMs: number,
  numStops: number
): [number, number][] {
  const totalDuration = endMs - startMs
  // Leave 15min transit gaps between stops
  const transitGap = 15 * 60 * 1000
  const availableTime = totalDuration - (numStops - 1) * transitGap
  const perStop = availableTime / numStops

  const windows: [number, number][] = []
  let current = startMs

  for (let i = 0; i < numStops; i++) {
    const arrival = current
    const departure = current + perStop
    windows.push([arrival, departure])
    current = departure + transitGap
  }

  return windows
}

/**
 * Allocate budget across stops based on purpose.
 */
export function allocateBudget(perPersonBudget: number, purposes: StopPurpose[]): number[] {
  // Normalize allocations for included purposes
  const totalWeight = purposes.reduce((sum, p) => sum + BUDGET_ALLOCATION[p], 0)

  return purposes.map(purpose => {
    const normalized = BUDGET_ALLOCATION[purpose] / totalWeight
    return Math.round(perPersonBudget * normalized)
  })
}

/**
 * Estimate transit between two locations.
 */
export function estimateTransit(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  toVenue?: Venue
): { duration: number; mode: TransitMode; deepLink?: string } {
  const dist = haversine(from.lat, from.lng, to.lat, to.lng)

  // Walking: under 0.5 miles, ~3mph
  if (dist < 0.5) {
    return {
      duration: Math.max(3, Math.round(dist * 20)),
      mode: 'walk',
    }
  }

  // Rideshare: over 0.5 miles
  const duration = Math.max(5, Math.round(dist * 3 + 5))
  const deepLink = toVenue
    ? generateRideshareLink('uber', toVenue, from.lat, from.lng).deepLink
    : undefined

  return {
    duration,
    mode: 'rideshare',
    deepLink,
  }
}

/**
 * Merge crew members' preferences to find common ground.
 */
export function mergeCrewPreferences(
  members: { preferences: PlanPreferences; budget: number }[]
): { preferences: PlanPreferences; averageBudget: number } {
  if (members.length === 0) {
    return {
      preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: [] },
      averageBudget: 100,
    }
  }

  // Find vibes that at least half the group wants
  const vibeCounts = new Map<string, number>()
  const genreCounts = new Map<string, number>()
  const typeCounts = new Map<string, number>()
  const avoidAll = new Set<string>()

  for (const member of members) {
    for (const v of member.preferences.vibes) {
      vibeCounts.set(v, (vibeCounts.get(v) ?? 0) + 1)
    }
    for (const g of member.preferences.musicGenres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
    }
    for (const t of member.preferences.venueTypes) {
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    }
    // Respect everyone's avoid list (union)
    for (const a of member.preferences.avoidCategories) {
      avoidAll.add(a)
    }
  }

  const threshold = Math.ceil(members.length / 2)
  const vibes = [...vibeCounts.entries()].filter(([, c]) => c >= threshold).map(([v]) => v)
  const musicGenres = [...genreCounts.entries()].filter(([, c]) => c >= threshold).map(([g]) => g)
  const venueTypes = [...typeCounts.entries()].filter(([, c]) => c >= threshold).map(([t]) => t)

  const averageBudget = Math.round(
    members.reduce((sum, m) => sum + m.budget, 0) / members.length
  )

  return {
    preferences: {
      vibes: vibes.length > 0 ? vibes : members[0].preferences.vibes,
      musicGenres,
      venueTypes,
      avoidCategories: [...avoidAll],
    },
    averageBudget,
  }
}

/**
 * Adapt a plan in real-time based on live energy scores.
 * If a planned venue has a low energy prediction, suggest swapping it.
 */
export function adaptPlan(
  currentPlan: NightPlan,
  currentTime: string,
  liveEnergyScores: Record<string, { energy: EnergyRating; score: number }>,
  venues: Venue[],
  pulses: Pulse[],
  user: User
): { plan: NightPlan; swapSuggestions: SwapSuggestion[] } {
  const now = new Date(currentTime).getTime()
  const swapSuggestions: SwapSuggestion[] = []

  const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }

  const updatedStops = currentPlan.stops.map((stop, i) => {
    const arrivalMs = new Date(stop.arrivalTime).getTime()

    // Only consider future stops
    if (arrivalMs < now) return stop
    if (stop.locked) return stop

    const liveData = liveEnergyScores[stop.venueId]
    if (!liveData) return stop

    // If live energy is 'dead', suggest a swap
    if (ENERGY_VALUES[liveData.energy] <= 0) {
      const location = { lat: 0, lng: 0 }
      const prevStop = i > 0 ? currentPlan.stops[i - 1] : null
      if (prevStop?.venueLocation) {
        location.lat = prevStop.venueLocation.lat
        location.lng = prevStop.venueLocation.lng
      }

      // Find alternative venue
      const usedIds = new Set(currentPlan.stops.map(s => s.venueId))
      const alternatives = venues
        .filter(v => !usedIds.has(v.id))
        .filter(v => {
          const altLive = liveEnergyScores[v.id]
          return !altLive || ENERGY_VALUES[altLive.energy] >= 2
        })
        .slice(0, 3)

      if (alternatives.length > 0) {
        swapSuggestions.push({
          stopIndex: i,
          currentVenue: stop.venueName,
          currentEnergy: liveData.energy,
          suggestedVenue: alternatives[0],
          reason: `${stop.venueName} looks dead right now. ${alternatives[0].name} is looking better.`,
        })
      }
    }

    // Update energy prediction with live data
    return { ...stop, energyPrediction: liveData.energy }
  })

  return {
    plan: { ...currentPlan, stops: updatedStops },
    swapSuggestions,
  }
}

export interface SwapSuggestion {
  stopIndex: number
  currentVenue: string
  currentEnergy: EnergyRating
  suggestedVenue: Venue
  reason: string
}

/**
 * Swap a stop in a plan with a new venue.
 */
export function swapStop(
  plan: NightPlan,
  stopIndex: number,
  newVenue: Venue,
  pulses: Pulse[]
): NightPlan {
  const stops = [...plan.stops]
  const oldStop = stops[stopIndex]
  if (!oldStop) return plan

  const arrivalHour = new Date(oldStop.arrivalTime).getHours()
  const dayOfWeek = new Date(oldStop.arrivalTime).getDay()
  const patterns = analyzeVenuePatterns(newVenue.id, pulses)
  const prediction = predictSurge(newVenue.id, patterns, arrivalHour, dayOfWeek)

  // Calculate transit from previous stop
  const prevLocation = stopIndex > 0 && stops[stopIndex - 1].venueLocation
    ? { lat: stops[stopIndex - 1].venueLocation!.lat, lng: stops[stopIndex - 1].venueLocation!.lng }
    : { lat: newVenue.location.lat, lng: newVenue.location.lng }

  const transit = estimateTransit(prevLocation, newVenue.location, newVenue)

  stops[stopIndex] = {
    ...oldStop,
    venueId: newVenue.id,
    venueName: newVenue.name,
    venueCategory: newVenue.category,
    venueLocation: newVenue.location,
    energyPrediction: prediction.predictedEnergyLevel,
    transitMode: transit.mode,
    transitDuration: transit.duration,
    transitDeepLink: transit.deepLink,
  }

  return { ...plan, stops }
}

/**
 * Get the current stop index based on time.
 */
export function getCurrentStopIndex(plan: NightPlan, currentTime: string): number {
  const now = new Date(currentTime).getTime()

  for (let i = plan.stops.length - 1; i >= 0; i--) {
    const arrival = new Date(plan.stops[i].arrivalTime).getTime()
    if (now >= arrival) return i
  }

  return -1
}

/**
 * Calculate total estimated spend for a plan.
 */
export function getTotalEstimatedSpend(plan: NightPlan): number {
  return plan.stops.reduce((sum, stop) => sum + stop.estimatedSpend, 0)
}

/**
 * Haversine distance in miles.
 */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Available vibes for the planner UI.
 */
export const PLANNER_VIBES = [
  { id: 'chill', label: 'Chill', emoji: '🍃' },
  { id: 'wild', label: 'Wild', emoji: '🔥' },
  { id: 'classy', label: 'Classy', emoji: '🥂' },
  { id: 'underground', label: 'Underground', emoji: '🎵' },
  { id: 'date night', label: 'Date Night', emoji: '❤️' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂' },
  { id: 'lowkey', label: 'Lowkey', emoji: '🌙' },
  { id: 'rooftop', label: 'Rooftop', emoji: '🌆' },
] as const

/**
 * Available venue types for preferences.
 */
export const VENUE_TYPES = [
  { id: 'bar', label: 'Bars' },
  { id: 'nightclub', label: 'Clubs' },
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'lounge', label: 'Lounges' },
  { id: 'brewery', label: 'Breweries' },
  { id: 'music_venue', label: 'Live Music' },
  { id: 'cocktail_bar', label: 'Cocktail Bars' },
  { id: 'wine_bar', label: 'Wine Bars' },
] as const
