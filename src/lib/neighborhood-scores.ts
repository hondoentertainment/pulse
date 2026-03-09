import type { Venue, Pulse, EnergyRating } from './types'

/** Phase 6.5 — Neighborhood & City Scores */

export interface Neighborhood {
  id: string; name: string; city: string
  bounds: { north: number; south: number; east: number; west: number }
  venueIds: string[]
}

export interface NeighborhoodScore {
  neighborhoodId: string; name: string; city: string; score: number
  activeVenueCount: number; totalVenues: number; dominantEnergy: EnergyRating
  trend: 'up' | 'down' | 'flat'; hottest: boolean
}

export interface CityScore {
  city: string; state?: string; score: number; neighborhoodCount: number
  activeNeighborhoods: number; totalVenues: number; activePulses24h: number
  dominantEnergy: EnergyRating; rank?: number
}

export interface CityComparison { cities: CityScore[]; rankedBy: string }

const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

export function calculateNeighborhoodScore(neighborhood: Neighborhood, venues: Venue[], pulses: Pulse[], windowHours: number = 4): NeighborhoodScore {
  const nVenues = venues.filter(v => neighborhood.venueIds.includes(v.id))
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000
  const recentPulses = pulses.filter(p => neighborhood.venueIds.includes(p.venueId) && new Date(p.createdAt).getTime() > cutoff)
  const activeVenues = new Set(recentPulses.map(p => p.venueId)).size
  const score = nVenues.length > 0 ? Math.round(nVenues.reduce((s, v) => s + v.pulseScore, 0) / nVenues.length) : 0
  const energySum = recentPulses.reduce((s, p) => s + ENERGY_VALUES[p.energyRating], 0)
  const avgEnergy = recentPulses.length > 0 ? energySum / recentPulses.length : 0
  return {
    neighborhoodId: neighborhood.id, name: neighborhood.name, city: neighborhood.city,
    score, activeVenueCount: activeVenues, totalVenues: nVenues.length,
    dominantEnergy: ENERGY_LABELS[Math.round(Math.min(3, avgEnergy))],
    trend: 'flat', hottest: false,
  }
}

export function getNeighborhoodLeaderboard(neighborhoods: Neighborhood[], venues: Venue[], pulses: Pulse[]): NeighborhoodScore[] {
  const scores = neighborhoods.map(n => calculateNeighborhoodScore(n, venues, pulses))
    .sort((a, b) => b.score - a.score)
  if (scores.length > 0) scores[0].hottest = true
  return scores
}

export function calculateCityScore(city: string, venues: Venue[], pulses: Pulse[]): CityScore {
  const cityVenues = venues.filter(v => v.city === city)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const recentPulses = pulses.filter(p => {
    const v = cityVenues.find(cv => cv.id === p.venueId)
    return v && new Date(p.createdAt).getTime() > cutoff
  })
  const score = cityVenues.length > 0 ? Math.round(cityVenues.reduce((s, v) => s + v.pulseScore, 0) / cityVenues.length) : 0
  const energySum = recentPulses.reduce((s, p) => s + ENERGY_VALUES[p.energyRating], 0)
  const avgEnergy = recentPulses.length > 0 ? energySum / recentPulses.length : 0
  return {
    city, score, neighborhoodCount: 0, activeNeighborhoods: 0,
    totalVenues: cityVenues.length, activePulses24h: recentPulses.length,
    dominantEnergy: ENERGY_LABELS[Math.round(Math.min(3, avgEnergy))],
  }
}

export function compareCities(cities: string[], venues: Venue[], pulses: Pulse[]): CityComparison {
  const scores = cities.map(c => calculateCityScore(c, venues, pulses))
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }))
  return { cities: scores, rankedBy: 'score' }
}

export function assignVenueToNeighborhood(venue: Venue, neighborhoods: Neighborhood[]): string | null {
  for (const n of neighborhoods) {
    const { north, south, east, west } = n.bounds
    if (venue.location.lat <= north && venue.location.lat >= south && venue.location.lng <= east && venue.location.lng >= west) {
      return n.id
    }
  }
  return null
}

export function getHottestNeighborhood(neighborhoods: Neighborhood[], venues: Venue[], pulses: Pulse[]): NeighborhoodScore | null {
  const board = getNeighborhoodLeaderboard(neighborhoods, venues, pulses)
  return board[0] ?? null
}

export function getCityTrending(city: string, venues: Venue[], pulses: Pulse[], limit: number = 10): Venue[] {
  return venues.filter(v => v.city === city).sort((a, b) => b.pulseScore - a.pulseScore).slice(0, limit)
}
