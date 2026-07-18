import type { SignalConfidence } from './decision-explanations'

/** Minimum confidence required before a surge alert may fire (PRD P1-2). */
export const MIN_SURGE_ALERT_CONFIDENCE: SignalConfidence = 'medium'

export const SURGE_SCORE_THRESHOLD = 60
export const MIN_SURGE_SCORE_INCREASE = 20
export const SURGE_ALERT_COOLDOWN_MS = 15 * 60 * 1000
export const MAX_SURGE_ALERTS_PER_VENUE = 3
export const SURGE_ALERT_MAX_DISTANCE_MILES = 5

const CONFIDENCE_RANK: Record<SignalConfidence, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
}

export function meetsSurgeConfidenceGate(
  confidence: SignalConfidence,
  minimum: SignalConfidence = MIN_SURGE_ALERT_CONFIDENCE,
): boolean {
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[minimum]
}

export interface SurgeAlertDecisionInput {
  currentScore: number
  lastScore: number
  lastAlertTime: number
  alertCount: number
  now: number
  confidence: SignalConfidence
  distanceMiles: number
  maxDistanceMiles?: number
  minConfidence?: SignalConfidence
  scoreThreshold?: number
  minScoreIncrease?: number
  cooldownMs?: number
  maxAlertsPerVenue?: number
}

/**
 * Pure surge-alert gate: score surge + proximity + confidence threshold.
 * Low/none confidence signals never alert — trust over noise.
 */
export function shouldEmitSurgeAlert(input: SurgeAlertDecisionInput): boolean {
  const scoreThreshold = input.scoreThreshold ?? SURGE_SCORE_THRESHOLD
  const minIncrease = input.minScoreIncrease ?? MIN_SURGE_SCORE_INCREASE
  const cooldownMs = input.cooldownMs ?? SURGE_ALERT_COOLDOWN_MS
  const maxAlerts = input.maxAlertsPerVenue ?? MAX_SURGE_ALERTS_PER_VENUE
  const maxDistance = input.maxDistanceMiles ?? SURGE_ALERT_MAX_DISTANCE_MILES
  const minConfidence = input.minConfidence ?? MIN_SURGE_ALERT_CONFIDENCE

  if (!meetsSurgeConfidenceGate(input.confidence, minConfidence)) return false
  if (input.currentScore < scoreThreshold) return false
  if (input.currentScore - input.lastScore < minIncrease) return false
  if (input.now - input.lastAlertTime < cooldownMs) return false
  if (input.alertCount >= maxAlerts) return false
  if (input.distanceMiles > maxDistance) return false
  return true
}

export function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
