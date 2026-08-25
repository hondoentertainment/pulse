/**
 * Versioned VenueSignal engine (P0-5).
 *
 * Unifies pulse reports and live intel into one decayed, confidence-weighted
 * signal. Every output carries `model_configuration.version` so clients can
 * reject stale models. Computation is synchronous so a 30s poll / realtime
 * fan-out stays inside the propagation SLA.
 */

import { calculatePulseScore, getEnergyLabel } from './pulse-engine'
import type { LiveReport, VenueLiveData } from './live-intelligence'
import { getVenueLiveDataFromReports } from './live-intelligence'
import type { Pulse, Venue } from './types'

export const VENUE_SIGNAL_MODEL_VERSION = 'venue-signal.v1'
export const SIGNAL_PROPAGATION_SLA_MS = 30_000

export type VenueSignalConfidence = 'low' | 'medium' | 'high'
export type VenueSignalTrend = 'rising' | 'steady' | 'falling' | 'unknown'
export type VenueSignalSource = 'pulse' | 'live_intel' | 'curated_seed'

export interface VenueSignalModelConfiguration {
  version: string
  pulseDecayMinutes: number
  liveIntelDecayMinutes: number
  propagationSlaMs: number
  pulseWeight: number
  liveIntelWeight: number
  risingVelocityThreshold: number
  fallingVelocityThreshold: number
}

export const DEFAULT_VENUE_SIGNAL_MODEL: VenueSignalModelConfiguration = {
  version: VENUE_SIGNAL_MODEL_VERSION,
  pulseDecayMinutes: 90,
  liveIntelDecayMinutes: 30,
  propagationSlaMs: SIGNAL_PROPAGATION_SLA_MS,
  pulseWeight: 0.62,
  liveIntelWeight: 0.38,
  risingVelocityThreshold: 1.2,
  fallingVelocityThreshold: -1.2,
}

export interface VenueSignalSourceMix {
  pulses: number
  liveReports: number
  curatedSeed: boolean
  sources: VenueSignalSource[]
}

export interface VenueSignal {
  venueId: string
  model_configuration: VenueSignalModelConfiguration
  energyScore: number
  energyLabel: string
  confidence: VenueSignalConfidence
  trend: VenueSignalTrend
  freshnessMinutes: number | null
  sourceMix: VenueSignalSourceMix
  friction: {
    waitMinutes: number | null
    lineStatus: VenueLiveData['doorMode']['lineStatus'] | null
    coverCharge: number | null
    label: string
  }
  computedAt: string
  withinPropagationSla: boolean
}

export interface ComputeVenueSignalInput {
  venue: Venue
  pulses?: Pulse[]
  liveReports?: LiveReport[]
  liveData?: VenueLiveData | null
  now?: Date
  model?: VenueSignalModelConfiguration
  ingestedAt?: Date
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function minutesSince(timestamp: string | undefined | null, nowMs: number): number | null {
  if (!timestamp) return null
  const time = new Date(timestamp).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, (nowMs - time) / 60_000)
}

function decayFactor(ageMinutes: number | null, decayMinutes: number): number {
  if (ageMinutes === null) return 1
  if (ageMinutes >= decayMinutes) return 0
  return 1 - ageMinutes / decayMinutes
}

function liveIntelScore(liveData: VenueLiveData | null): number {
  if (!liveData) return 0
  const crowd = liveData.crowdLevel || 0
  const waitPenalty =
    liveData.waitTime === null ? 0 : liveData.waitTime <= 5 ? 8 : liveData.waitTime <= 15 ? 0 : -12
  return clamp(crowd + waitPenalty, 0, 100)
}

function computeConfidence(
  pulseCount: number,
  liveReportCount: number,
  freshnessMinutes: number | null,
): VenueSignalConfidence {
  const recent = freshnessMinutes !== null && freshnessMinutes <= 15
  if (pulseCount + liveReportCount >= 5 && recent) return 'high'
  if (pulseCount + liveReportCount >= 2 && freshnessMinutes !== null && freshnessMinutes <= 45) return 'medium'
  return 'low'
}

function computeTrend(venue: Venue, pulses: Pulse[], nowMs: number): VenueSignalTrend {
  if (typeof venue.scoreVelocity === 'number') {
    if (venue.scoreVelocity >= DEFAULT_VENUE_SIGNAL_MODEL.risingVelocityThreshold) return 'rising'
    if (venue.scoreVelocity <= DEFAULT_VENUE_SIGNAL_MODEL.fallingVelocityThreshold) return 'falling'
    if (pulses.length > 0 || venue.scoreVelocity !== 0) return 'steady'
  }

  const recent = pulses
    .map((pulse) => new Date(pulse.createdAt).getTime())
    .filter((time) => Number.isFinite(time) && nowMs - time <= 90 * 60_000)
    .sort((a, b) => a - b)

  if (recent.length < 2) return 'unknown'
  const midpoint = recent[0] + (recent[recent.length - 1] - recent[0]) / 2
  const firstHalf = recent.filter((time) => time <= midpoint).length
  const secondHalf = recent.length - firstHalf
  if (secondHalf >= firstHalf + 2) return 'rising'
  if (firstHalf >= secondHalf + 2) return 'falling'
  return 'steady'
}

function frictionLabel(liveData: VenueLiveData | null): VenueSignal['friction'] {
  if (!liveData || (liveData.waitTime === null && liveData.coverCharge === null)) {
    return { waitMinutes: null, lineStatus: null, coverCharge: null, label: 'Door friction unknown' }
  }

  const wait = liveData.waitTime
  const cover = liveData.coverCharge
  const parts: string[] = []
  if (wait === 0) parts.push('No wait')
  else if (wait !== null) parts.push(`~${wait} min door`)
  if (cover === 0) parts.push('No cover')
  else if (cover !== null) parts.push(`$${cover} cover`)

  return {
    waitMinutes: wait,
    lineStatus: liveData.doorMode.lineStatus,
    coverCharge: cover,
    label: parts.join(' · ') || 'Door friction unknown',
  }
}

export function computeVenueSignal(input: ComputeVenueSignalInput): VenueSignal {
  const model = input.model ?? DEFAULT_VENUE_SIGNAL_MODEL
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const pulses = (input.pulses ?? []).filter((pulse) => pulse.venueId === input.venue.id)
  const liveReports = (input.liveReports ?? []).filter((report) => report.venueId === input.venue.id)
  const liveData = input.liveData ?? (liveReports.length > 0 ? getVenueLiveDataFromReports(input.venue.id, liveReports) : null)

  const pulseScore = pulses.length > 0
    ? calculatePulseScore(pulses, true, nowMs, model.pulseDecayMinutes)
    : 0
  const intelScore = liveIntelScore(liveData) * decayFactor(
    minutesSince(
      input.venue.liveSummary?.lastReportAt ?? input.venue.liveSummary?.updatedAt ?? liveData?.lastUpdated,
      nowMs,
    ),
    model.liveIntelDecayMinutes,
  )
  const hasLiveInputs = pulses.length > 0 || liveReports.length > 0
  const blended = hasLiveInputs
    ? Math.round(pulseScore * model.pulseWeight + intelScore * model.liveIntelWeight)
    : 0

  const pulseFreshness = minutesSince(input.venue.lastPulseAt ?? pulses[0]?.createdAt, nowMs)
  const liveFreshness = minutesSince(
    input.venue.liveSummary?.lastReportAt ?? input.venue.liveSummary?.updatedAt ?? liveData?.lastUpdated,
    nowMs,
  )
  const freshnessMinutes = [pulseFreshness, liveFreshness]
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0] ?? null

  const curatedSeed = input.venue.seeded === true || input.venue.inventorySource === 'curated-seed'
  const sources: VenueSignalSource[] = []
  if (pulses.length > 0) sources.push('pulse')
  if (liveReports.length > 0 || (liveData?.crowdLevel ?? 0) > 0 || liveData?.waitTime !== null && liveData?.waitTime !== undefined) {
    if (liveReports.length > 0 || (input.venue.liveSummary?.reportCount ?? 0) > 0) sources.push('live_intel')
  }
  if (sources.length === 0 && curatedSeed) sources.push('curated_seed')

  const computedAt = now.toISOString()
  const ingestedAt = input.ingestedAt?.getTime() ?? nowMs

  return {
    venueId: input.venue.id,
    model_configuration: model,
    energyScore: clamp(blended, 0, 100),
    energyLabel: getEnergyLabel(blended),
    confidence: computeConfidence(pulses.length, liveReports.length, freshnessMinutes),
    trend: computeTrend(input.venue, pulses, nowMs),
    freshnessMinutes: freshnessMinutes === null ? null : Math.round(freshnessMinutes),
    sourceMix: {
      pulses: pulses.length,
      liveReports: liveReports.length,
      curatedSeed,
      sources,
    },
    friction: frictionLabel(liveData),
    computedAt,
    withinPropagationSla: nowMs - ingestedAt <= model.propagationSlaMs,
  }
}

export function isSignalWithinPropagationSla(
  computedAt: string,
  ingestedAt: string,
  slaMs: number = SIGNAL_PROPAGATION_SLA_MS,
): boolean {
  return new Date(computedAt).getTime() - new Date(ingestedAt).getTime() <= slaMs
}
