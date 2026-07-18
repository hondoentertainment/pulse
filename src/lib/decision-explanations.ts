import type { EnergyRating, Venue } from './types'
import type { Recommendation, RecommendationReason } from './venue-recommendations'
import { getEnergyLabel } from './pulse-engine'

export type SignalConfidence = 'high' | 'medium' | 'low' | 'none'
export type EnergyTrend = 'rising' | 'steady' | 'fading' | 'unknown'
export type WorthGoingVerdict = 'yes' | 'maybe' | 'caution' | 'unknown'

export interface DecisionExplanationInput {
  venue: Venue
  reasons: RecommendationReason[]
  confidence: SignalConfidence
  freshnessMinutes: number | null
  reportCount: number
  distanceMiles: number | null
  trend: EnergyTrend
  energyMatch: boolean
  desiredVibe?: EnergyRating | 'any'
}

export interface DecisionExplanation {
  headline: string
  explanation: string
  confidenceLabel: string
  freshnessLabel: string
  worthGoing: WorthGoingVerdict
  frictionNotes: string[]
}

function formatDistance(miles: number | null): string | null {
  if (miles === null || !Number.isFinite(miles)) return null
  if (miles < 0.2) return 'under 5 min away'
  const minutes = Math.max(1, Math.round(miles * 4))
  return `${minutes} min away`
}

function trendPhrase(trend: EnergyTrend): string | null {
  switch (trend) {
    case 'rising':
      return 'getting busier'
    case 'fading':
      return 'cooling down'
    case 'steady':
      return 'holding steady'
    default:
      return null
  }
}

function confidenceLabel(level: SignalConfidence): string {
  switch (level) {
    case 'high':
      return 'Strong live consensus'
    case 'medium':
      return 'Moderate live consensus'
    case 'low':
      return 'Thin live consensus'
    default:
      return 'No live reviews'
  }
}

function freshnessLabel(minutes: number | null, reportCount: number): string {
  if (minutes === null || reportCount === 0) return 'No live reviews yet'
  const reviews = reportCount === 1 ? '1 live review' : `${reportCount} live reviews`
  if (minutes <= 15) return `${reviews} · last ${minutes} min`
  if (minutes <= 45) return `${reviews} · last ${minutes} min`
  if (minutes <= 90) return `${reviews} · last known ${minutes} min ago`
  return 'Live reviews are aging — treat as last known'
}

export function deriveWorthGoing(
  confidence: SignalConfidence,
  energyMatch: boolean,
  freshnessMinutes: number | null,
): WorthGoingVerdict {
  if (confidence === 'none') return 'unknown'
  if (confidence === 'low' || freshnessMinutes === null || freshnessMinutes > 90) return 'caution'
  if (confidence === 'high' && energyMatch) return 'yes'
  if (confidence === 'medium' && energyMatch) return 'maybe'
  if (!energyMatch) return 'maybe'
  return 'caution'
}

export function buildDecisionExplanation(input: DecisionExplanationInput): DecisionExplanation {
  const energy = getEnergyLabel(input.venue.pulseScore)
  const trend = trendPhrase(input.trend)
  const distance = formatDistance(input.distanceMiles)
  const topReasons = input.reasons.slice(0, 2).map((r) => r.label.toLowerCase())

  const matchBits: string[] = []
  if (topReasons.length > 0) matchBits.push(topReasons.join(', '))
  if (input.energyMatch && input.desiredVibe && input.desiredVibe !== 'any') {
    matchBits.push(`matches your ${input.desiredVibe} vibe`)
  }

  const headline = trend
    ? `${input.venue.name} is ${energy} and ${trend}.`
    : `${input.venue.name} is ${energy}.`

  const matchSentence =
    matchBits.length > 0
      ? `Strong match because ${matchBits.join(' and ')}.`
      : 'Decent fit based on your preferences and what we know right now.'

  const distanceSentence = distance ? ` It is ${distance}.` : ''

  const explanation = `${matchSentence}${distanceSentence} ${freshnessLabel(
    input.freshnessMinutes,
    input.reportCount,
  )}. ${confidenceLabel(input.confidence)}.`

  const frictionNotes: string[] = []
  if (input.confidence === 'low') frictionNotes.push('Few live reviews so far')
  if (input.freshnessMinutes !== null && input.freshnessMinutes > 60) {
    frictionNotes.push('Reviews may be going stale')
  }
  if (distance && input.distanceMiles !== null && input.distanceMiles > 3) {
    frictionNotes.push('Farther than your usual picks')
  }
  if (!input.energyMatch) frictionNotes.push('Energy may not match your selected vibe')

  return {
    headline,
    explanation,
    confidenceLabel: confidenceLabel(input.confidence),
    freshnessLabel: freshnessLabel(input.freshnessMinutes, input.reportCount),
    worthGoing: deriveWorthGoing(input.confidence, input.energyMatch, input.freshnessMinutes),
    frictionNotes,
  }
}

/** Map a base recommendation into PRD-style copy for the Tonight feed. */
export function explainRecommendation(
  rec: Recommendation,
  extras: Omit<DecisionExplanationInput, 'venue' | 'reasons'>,
): DecisionExplanation {
  return buildDecisionExplanation({
    venue: rec.venue,
    reasons: rec.reasons,
    ...extras,
  })
}
