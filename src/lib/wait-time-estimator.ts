/**
 * Wait-time estimator (pure, testable).
 *
 * ---
 * Formula
 * ---
 *   velocity_20min   = count(check-ins in last 20 minutes)
 *   velocity_60min   = count(check-ins in last 60 minutes)
 *   capacity         = max(venue.capacityHint ?? 80, 20)
 *   load             = velocity_20min / (capacity * 0.20)
 *                      (1.0 means "capacity filling up in ~20 min, expect a line")
 *   rawMinutes       = 60 * load * (1 + pulse_pressure)
 *   pulse_pressure   = clamp(recentElectricPulseCount / 10, 0, 0.5)
 *                      (social-proof signal: if many 'electric' pulses in last
 *                       60 min, nudge expected wait up by up to 50%)
 *   estimatedMinutes = clamp(round(rawMinutes), 0, 90)
 *
 * Confidence bands (driven by sample size = velocity_60min + pulseCount60):
 *   sample < 5  -> 'low'
 *   5 - 15      -> 'med'
 *   16+         -> 'high'
 *
 * Edge cases:
 *   - Empty input / zero capacity -> 0 min, 'low' confidence, sample_size=0.
 *   - Huge velocities are capped at 90 min so we never display "3h wait".
 *   - capacityHint <= 0 is treated as the default.
 */

import type { VenueWaitTime, WaitTimeConfidence } from './types'

export interface WaitTimeInputRow {
  /** ISO timestamp. */
  createdAt: string
}

export interface WaitTimePulseRow extends WaitTimeInputRow {
  energyRating?: 'dead' | 'chill' | 'buzzing' | 'electric'
}

export interface WaitTimeEstimatorInput {
  /** Recent check-ins (any rows with createdAt). */
  checkIns: WaitTimeInputRow[]
  /** Recent pulses. */
  pulses: WaitTimePulseRow[]
  /** Hint of venue occupancy capacity. Falls back to DEFAULT_CAPACITY. */
  capacityHint?: number
  /** Override "now" for deterministic tests. */
  now?: Date
}

export interface WaitTimeEstimatorResult {
  estimatedMinutes: number
  confidence: WaitTimeConfidence
  sampleSize: number
}

export const DEFAULT_CAPACITY = 80
export const WINDOW_SHORT_MS = 20 * 60 * 1000
export const WINDOW_LONG_MS = 60 * 60 * 1000
export const MAX_WAIT_MIN = 90

const parseTs = (iso: string): number => {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : NaN
}

const countWithin = (rows: WaitTimeInputRow[], fromMs: number, toMs: number): number => {
  let n = 0
  for (const row of rows) {
    const t = parseTs(row.createdAt)
    if (!Number.isFinite(t)) continue
    if (t >= fromMs && t <= toMs) n++
  }
  return n
}

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v))

const confidenceFor = (sample: number): WaitTimeConfidence => {
  if (sample >= 16) return 'high'
  if (sample >= 5) return 'med'
  return 'low'
}

/**
 * Compute a wait-time estimate from raw telemetry.
 *
 * Pure: no I/O, no date-now dependence (when `now` is passed).
 */
export function estimateWaitTime(
  input: WaitTimeEstimatorInput,
): WaitTimeEstimatorResult {
  const nowMs = (input.now ?? new Date()).getTime()
  const shortFrom = nowMs - WINDOW_SHORT_MS
  const longFrom = nowMs - WINDOW_LONG_MS

  const checkIns = Array.isArray(input.checkIns) ? input.checkIns : []
  const pulses = Array.isArray(input.pulses) ? input.pulses : []

  const velocityShort = countWithin(checkIns, shortFrom, nowMs)
  const velocityLong = countWithin(checkIns, longFrom, nowMs)
  const pulseCountLong = countWithin(pulses, longFrom, nowMs)

  const electricInLong = pulses.reduce((acc, p) => {
    const t = parseTs(p.createdAt)
    if (!Number.isFinite(t) || t < longFrom || t > nowMs) return acc
    return p.energyRating === 'electric' ? acc + 1 : acc
  }, 0)

  const capacity = Math.max(
    input.capacityHint && input.capacityHint > 0 ? input.capacityHint : DEFAULT_CAPACITY,
    20,
  )

  const sampleSize = velocityLong + pulseCountLong

  if (sampleSize === 0) {
    return { estimatedMinutes: 0, confidence: 'low', sampleSize: 0 }
  }

  const capacityFor20min = capacity * 0.2
  const load = velocityShort / Math.max(capacityFor20min, 1)
  const pulsePressure = clamp(electricInLong / 10, 0, 0.5)
  const rawMinutes = 60 * load * (1 + pulsePressure)
  const estimatedMinutes = clamp(Math.round(rawMinutes), 0, MAX_WAIT_MIN)

  return {
    estimatedMinutes,
    confidence: confidenceFor(sampleSize),
    sampleSize,
  }
}

/** Convenience helper to stamp a server-shaped row. */
export function toWaitTimeRow(
  venueId: string,
  result: WaitTimeEstimatorResult,
  now: Date = new Date(),
): VenueWaitTime {
  return {
    venueId,
    estimatedMinutes: result.estimatedMinutes,
    confidence: result.confidence,
    sampleSize: result.sampleSize,
    computedAt: now.toISOString(),
  }
}

/** A wait-time row is considered "fresh" for reuse for this many ms. */
export const WAIT_TIME_TTL_MS = 15 * 60 * 1000

export function isWaitTimeFresh(
  row: Pick<VenueWaitTime, 'computedAt'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row?.computedAt) return false
  const t = Date.parse(row.computedAt)
  if (!Number.isFinite(t)) return false
  return now.getTime() - t < WAIT_TIME_TTL_MS
}
