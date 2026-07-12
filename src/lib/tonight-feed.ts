import type { EnergyRating, Pulse, User, Venue } from './types'
import { calculateDistance, getEnergyLabel, scoreToEnergyRating } from './pulse-engine'
import { getRecommendations, type Recommendation } from './venue-recommendations'
import {
  buildDecisionExplanation,
  type DecisionExplanation,
  type EnergyTrend,
  type SignalConfidence,
} from './decision-explanations'
import { PULSE_DECAY_MINUTES } from './types'

export type VibeFilter = EnergyRating | 'any'

export interface TonightPick {
  recommendation: Recommendation
  explanation: DecisionExplanation
  confidence: SignalConfidence
  trend: EnergyTrend
  freshnessMinutes: number | null
  reportCount: number
  distanceMiles: number | null
  energyMatch: boolean
}

function recentPulsesForVenue(venueId: string, pulses: Pulse[]): Pulse[] {
  const cutoff = Date.now() - PULSE_DECAY_MINUTES * 60 * 1000
  return pulses.filter(
    (p) => p.venueId === venueId && new Date(p.createdAt).getTime() >= cutoff,
  )
}

function deriveConfidence(reportCount: number, freshnessMinutes: number | null): SignalConfidence {
  if (reportCount === 0 || freshnessMinutes === null) return 'none'
  if (reportCount >= 3 && freshnessMinutes <= 45) return 'high'
  if (reportCount >= 2 && freshnessMinutes <= 60) return 'medium'
  if (reportCount >= 1 && freshnessMinutes <= 90) return 'low'
  return 'none'
}

function deriveTrend(venue: Venue, pulses: Pulse[]): EnergyTrend {
  const recent = recentPulsesForVenue(venue.id, pulses)
  if (recent.length < 2) return 'unknown'
  const sorted = [...recent].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2))
  const secondHalf = sorted.slice(Math.ceil(sorted.length / 2))
  const avgEnergy = (items: Pulse[]) => {
    if (items.length === 0) return 0
    const map: Record<EnergyRating, number> = {
      dead: 1,
      chill: 2,
      buzzing: 3,
      electric: 4,
    }
    return items.reduce((sum, p) => sum + map[p.energyRating], 0) / items.length
  }
  const delta = avgEnergy(secondHalf) - avgEnergy(firstHalf)
  if (delta >= 0.4) return 'rising'
  if (delta <= -0.4) return 'fading'
  return 'steady'
}

function getFreshnessMinutes(venue: Venue, pulses: Pulse[]): { minutes: number | null; count: number } {
  const recent = recentPulsesForVenue(venue.id, pulses)
  if (recent.length === 0) {
    const stamps = [venue.lastPulseAt, venue.lastActivity].filter(Boolean) as string[]
    if (stamps.length === 0) return { minutes: null, count: 0 }
    const latest = Math.max(...stamps.map((s) => new Date(s).getTime()))
    return {
      minutes: Math.max(0, Math.round((Date.now() - latest) / 60000)),
      count: 0,
    }
  }
  const latest = Math.max(...recent.map((p) => new Date(p.createdAt).getTime()))
  return {
    minutes: Math.max(0, Math.round((Date.now() - latest) / 60000)),
    count: recent.length,
  }
}

function energyMatchesFilter(score: number, vibe: VibeFilter): boolean {
  if (vibe === 'any') return true
  return scoreToEnergyRating(score) === vibe
}

function vibeEnergyRank(score: number, vibe: VibeFilter): number {
  if (vibe === 'any') return score
  const target = { dead: 12, chill: 37, buzzing: 62, electric: 87 }[vibe]
  return score - Math.abs(score - target) * 0.5
}

/**
 * PRD §9-weighted Tonight picks: personal fit + energy match + confidence + distance + trend.
 */
export function getTonightPicks(
  user: User,
  venues: Venue[],
  pulses: Pulse[],
  options: {
    vibe?: VibeFilter
    userLocation?: { lat: number; lng: number }
    limit?: number
    now?: Date
  } = {},
): TonightPick[] {
  const vibe = options.vibe ?? 'any'
  const limit = options.limit ?? 12
  const base = getRecommendations(user, venues, pulses, options.userLocation, options.now, limit * 2)

  const picks: TonightPick[] = base.map((rec) => {
    const { minutes, count } = getFreshnessMinutes(rec.venue, pulses)
    const confidence = deriveConfidence(count, minutes)
    const trend = deriveTrend(rec.venue, pulses)
    const distanceMiles =
      options.userLocation && rec.venue.location
        ? calculateDistance(
            options.userLocation.lat,
            options.userLocation.lng,
            rec.venue.location.lat,
            rec.venue.location.lng,
          )
        : null
    const energyMatch = energyMatchesFilter(rec.venue.pulseScore, vibe)
    const explanation = buildDecisionExplanation({
      venue: rec.venue,
      reasons: rec.reasons,
      confidence,
      freshnessMinutes: minutes,
      reportCount: count,
      distanceMiles,
      trend,
      energyMatch,
      desiredVibe: vibe,
    })

    return {
      recommendation: rec,
      explanation,
      confidence,
      trend,
      freshnessMinutes: minutes,
      reportCount: count,
      distanceMiles,
      energyMatch,
    }
  })

  const filtered = picks.filter((p) => {
    if (vibe === 'any') return p.confidence !== 'none' || p.recommendation.venue.pulseScore > 0
    return p.energyMatch && p.confidence !== 'none'
  })

  const ranked = (filtered.length > 0 ? filtered : picks).sort((a, b) => {
    const confWeight = { high: 3, medium: 2, low: 1, none: 0 }
    const aScore =
      vibeEnergyRank(a.recommendation.venue.pulseScore, vibe) * 0.25 +
      a.recommendation.score * 0.3 +
      confWeight[a.confidence] * 20 +
      (a.distanceMiles !== null ? Math.max(0, 10 - a.distanceMiles) : 0) +
      (a.trend === 'rising' ? 5 : 0)
    const bScore =
      vibeEnergyRank(b.recommendation.venue.pulseScore, vibe) * 0.25 +
      b.recommendation.score * 0.3 +
      confWeight[b.confidence] * 20 +
      (b.distanceMiles !== null ? Math.max(0, 10 - b.distanceMiles) : 0) +
      (b.trend === 'rising' ? 5 : 0)
    return bScore - aScore
  })

  return ranked.slice(0, limit)
}

export function formatTonightEnergySummary(score: number): string {
  return getEnergyLabel(score)
}
