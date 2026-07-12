import type { EnergyRating, Pulse, User, Venue } from './types'
import { calculateDistance, getEnergyLabel, scoreToEnergyRating } from './pulse-engine'
import { getRecommendations, type Recommendation } from './venue-recommendations'
import {
  buildDecisionExplanation,
  type DecisionExplanation,
  type EnergyTrend,
  type SignalConfidence,
} from './decision-explanations'
import { computeVenueSignal } from './venue-signal'

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
    const signal = computeVenueSignal(rec.venue, pulses, { now: options.now })
    const { freshnessMinutes: minutes, reportCount: count, confidence, trend } = signal
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
