import type { Pulse } from './types'
import { PULSE_DECAY_MINUTES } from './types'
import { calculatePulseScore } from './pulse-engine'
import type { EnergyTrend } from './decision-explanations'

export const ENERGY_TIMELINE_BUCKET_COUNT = 12
export const ENERGY_TIMELINE_WINDOW_HOURS = 6

export interface EnergyTimelinePoint {
  /** Minutes before `now` (0 = current bucket). */
  minutesAgo: number
  score: number
  reportCount: number
}

export interface EnergyTimelineSummary {
  points: number[]
  trend: EnergyTrend
  trendLabel: string
  peakIndex: number
  /** True when there is no report history in the window (honest empty state). */
  usesSyntheticFallback: boolean
  /** False when the UI should not present a confident energy curve. */
  hasLiveHistory: boolean
}

const TREND_LABELS: Record<EnergyTrend, string> = {
  rising: 'Heating up',
  steady: 'Holding steady',
  fading: 'Cooling down',
  unknown: 'Not enough reports yet',
}

function deriveTrendFromPoints(points: number[]): EnergyTrend {
  if (points.length < 2) return 'unknown'
  const mid = Math.floor(points.length / 2)
  const first = points.slice(0, mid)
  const second = points.slice(mid)
  const avg = (items: number[]) =>
    items.length === 0 ? 0 : items.reduce((sum, v) => sum + v, 0) / items.length
  const delta = avg(second) - avg(first)
  if (delta >= 8) return 'rising'
  if (delta <= -8) return 'fading'
  if (points.every((v) => v === 0)) return 'unknown'
  return 'steady'
}

function findPeakIndex(points: number[]): number {
  let peak = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i] > points[peak]) peak = i
  }
  return peak
}

/** Seeded fallback when no pulse history exists (demo / cold start). */
export function generateSyntheticTimeline(venueId: string, currentScore: number): number[] {
  let seed = 0
  for (let i = 0; i < venueId.length; i++) {
    seed = ((seed << 5) - seed + venueId.charCodeAt(i)) | 0
  }
  const seededRandom = () => {
    seed = (seed * 16807) % 2147483647
    return (seed & 0x7fffffff) / 2147483647
  }

  const points = ENERGY_TIMELINE_BUCKET_COUNT
  const data: number[] = []
  const baseStart = Math.max(5, currentScore * 0.15)

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1)
    const base = baseStart + (currentScore - baseStart) * progress ** 1.5
    const noise = (seededRandom() - 0.5) * currentScore * 0.2
    data.push(Math.max(0, Math.min(100, Math.round(base + noise))))
  }

  data[data.length - 1] = currentScore
  return data
}

/**
 * Build a 6-hour energy timeline from venue pulses using the same decay/scoring
 * model as the live score, evaluated at 30-minute bucket boundaries.
 */
export function buildEnergyTimelineFromPulses(
  venueId: string,
  pulses: Pulse[],
  currentScore: number,
  options: {
    bucketCount?: number
    windowHours?: number
    decayMinutes?: number
    now?: number
  } = {},
): EnergyTimelineSummary {
  const bucketCount = options.bucketCount ?? ENERGY_TIMELINE_BUCKET_COUNT
  const windowHours = options.windowHours ?? ENERGY_TIMELINE_WINDOW_HOURS
  const decayMinutes = options.decayMinutes ?? PULSE_DECAY_MINUTES
  const now = options.now ?? Date.now()
  const decayMs = decayMinutes * 60 * 1000
  const bucketSpanMs =
    bucketCount > 1 ? (windowHours * 60 * 60 * 1000) / (bucketCount - 1) : 0

  const venuePulses = pulses.filter((p) => p.venueId === venueId)
  const hasReports = venuePulses.some((p) => {
    const age = now - new Date(p.createdAt).getTime()
    return age <= windowHours * 60 * 60 * 1000 + decayMs
  })

  if (!hasReports) {
    // Honest empty: never invent a confident curve for cold-start venues.
    const empty = Array.from({ length: bucketCount }, () => 0)
    return {
      points: empty,
      trend: 'unknown',
      trendLabel: TREND_LABELS.unknown,
      peakIndex: 0,
      usesSyntheticFallback: true,
      hasLiveHistory: false,
    }
  }

  const points: number[] = []
  for (let i = 0; i < bucketCount; i++) {
    const bucketEnd = now - (bucketCount - 1 - i) * bucketSpanMs
    const relevant = venuePulses.filter((p) => {
      const t = new Date(p.createdAt).getTime()
      if (t > bucketEnd) return false
      return bucketEnd - t <= decayMs
    })
    points.push(relevant.length > 0 ? calculatePulseScore(relevant) : 0)
  }

  points[points.length - 1] = currentScore
  const trend = deriveTrendFromPoints(points)

  return {
    points,
    trend,
    trendLabel: TREND_LABELS[trend],
    peakIndex: findPeakIndex(points),
    usesSyntheticFallback: false,
    hasLiveHistory: true,
  }
}
