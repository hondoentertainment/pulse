import type { Venue } from './types'
import { normalizeCategoryKeyPublic } from './time-contextual-scoring'

/** A single data point on the 24-hour energy timeline */
export interface EnergyDataPoint {
  /** Hour of day (0–23) */
  timestamp: number
  /** Energy / pulse score for this hour (0–100) */
  score: number
  /** Optional display label, e.g. "Happy Hour" */
  label?: string
  /** Simulated check-in count for this hour */
  checkinCount: number
  /** Whether this is the current hour */
  isCurrentHour: boolean
}

export type EnergyTrend = 'rising' | 'falling' | 'peaking' | 'quiet'

export interface VenueEnergyHistory {
  venueId: string
  dataPoints: EnergyDataPoint[]
  peakHour: number
  currentScore: number
  trend: EnergyTrend
  bestTimeToVisit: number
  comparedToLastWeek: string
}

// ---- Category curve templates (hour -> expected score 0–1 multiplier) ----

type CurveMap = Record<string, number[]>

/**
 * Each array has 24 entries (index 0 = midnight, 23 = 11PM).
 * Values are 0–1 multipliers applied to a base score.
 */
const CATEGORY_CURVES: CurveMap = {
  nightclub: [
    0.70, 0.40, 0.15, 0.05, 0.02, 0.01, // 0-5
    0.01, 0.01, 0.01, 0.02, 0.03, 0.05, // 6-11
    0.05, 0.05, 0.05, 0.06, 0.08, 0.12, // 12-17
    0.18, 0.25, 0.40, 0.60, 0.82, 0.95, // 18-23
  ],
  bar: [
    0.35, 0.15, 0.05, 0.02, 0.01, 0.01, // 0-5
    0.01, 0.02, 0.03, 0.05, 0.08, 0.12, // 6-11
    0.18, 0.20, 0.18, 0.20, 0.30, 0.45, // 12-17
    0.55, 0.65, 0.80, 0.92, 0.98, 0.85, // 18-23
  ],
  restaurant: [
    0.05, 0.02, 0.01, 0.01, 0.01, 0.02, // 0-5
    0.05, 0.15, 0.30, 0.25, 0.15, 0.35, // 6-11
    0.65, 0.55, 0.30, 0.20, 0.25, 0.50, // 12-17
    0.80, 0.95, 0.90, 0.65, 0.35, 0.15, // 18-23
  ],
  cafe: [
    0.01, 0.01, 0.01, 0.01, 0.02, 0.05, // 0-5
    0.20, 0.55, 0.90, 0.95, 0.80, 0.55, // 6-11
    0.45, 0.50, 0.55, 0.45, 0.30, 0.15, // 12-17
    0.08, 0.04, 0.02, 0.01, 0.01, 0.01, // 18-23
  ],
  music_venue: [
    0.40, 0.15, 0.05, 0.02, 0.01, 0.01, // 0-5
    0.01, 0.02, 0.03, 0.05, 0.08, 0.10, // 6-11
    0.10, 0.12, 0.12, 0.15, 0.18, 0.30, // 12-17
    0.50, 0.70, 0.90, 0.98, 0.85, 0.60, // 18-23
  ],
  brewery: [
    0.05, 0.02, 0.01, 0.01, 0.01, 0.01, // 0-5
    0.02, 0.05, 0.08, 0.10, 0.15, 0.25, // 6-11
    0.40, 0.55, 0.65, 0.70, 0.75, 0.80, // 12-17
    0.85, 0.75, 0.55, 0.35, 0.20, 0.10, // 18-23
  ],
  gallery: [
    0.01, 0.01, 0.01, 0.01, 0.01, 0.01, // 0-5
    0.02, 0.05, 0.10, 0.20, 0.40, 0.60, // 6-11
    0.75, 0.85, 0.90, 0.80, 0.65, 0.50, // 12-17
    0.35, 0.25, 0.15, 0.08, 0.03, 0.01, // 18-23
  ],
}

const HOUR_LABELS: Record<string, Record<number, string>> = {
  nightclub: { 22: 'Doors Open', 23: 'Peak Energy', 0: 'Late Night' },
  bar: { 17: 'Happy Hour', 21: 'Peak Crowd', 23: 'Last Call' },
  restaurant: { 12: 'Lunch Rush', 19: 'Dinner Peak', 20: 'Prime Time' },
  cafe: { 8: 'Morning Rush', 9: 'Peak Hours', 12: 'Lunch Crowd' },
  music_venue: { 20: 'Doors Open', 21: 'Showtime', 22: 'Peak Set' },
  brewery: { 14: 'Afternoon Crowd', 17: 'After Work', 18: 'Peak Time' },
  gallery: { 14: 'Peak Visitors', 18: 'Evening Event' },
}

/** Seeded pseudo-random for deterministic variation per venue */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Generate a realistic 24-hour energy history for a venue
 * based on its category and a seeded random variation.
 */
export function generateEnergyHistory(venue: Venue, currentTime: Date = new Date()): VenueEnergyHistory {
  const catKey = normalizeCategoryKeyPublic(venue.category)
  const curve = CATEGORY_CURVES[catKey] ?? CATEGORY_CURVES.bar
  const labels = HOUR_LABELS[catKey] ?? HOUR_LABELS.bar
  const currentHour = currentTime.getHours()

  // Venue-specific random to give each venue a slightly different curve
  const rand = seededRandom(hashString(venue.id))
  const baseScore = Math.max(20, Math.min(100, venue.pulseScore || 50))

  const rawPoints: EnergyDataPoint[] = curve.map((multiplier, hour) => {
    // Add per-venue variation (+/-15%)
    const variation = 0.85 + rand() * 0.30
    const rawScore = Math.round(baseScore * multiplier * variation)
    const score = Math.max(0, Math.min(100, rawScore))
    const checkinCount = Math.round(score / 8 + rand() * 3)

    return {
      timestamp: hour,
      score,
      label: labels[hour],
      checkinCount: Math.max(0, checkinCount),
      isCurrentHour: hour === currentHour,
    }
  })

  const dataPoints = smoothDataPoints(rawPoints)

  // Restore labels and isCurrentHour after smoothing
  for (let i = 0; i < dataPoints.length; i++) {
    dataPoints[i].label = rawPoints[i].label
    dataPoints[i].isCurrentHour = rawPoints[i].isCurrentHour
  }

  const peakHour = findPeakHour(dataPoints)
  const currentScore = dataPoints[currentHour].score
  const trend = calculateTrend(dataPoints, currentHour)
  const bestTimeToVisit = findBestTimeToVisit(dataPoints, currentHour)
  const comparedToLastWeek = compareToLastWeek(dataPoints, currentTime.getDay())

  return {
    venueId: venue.id,
    dataPoints,
    peakHour,
    currentScore,
    trend,
    bestTimeToVisit,
    comparedToLastWeek,
  }
}

/** Find the hour with the highest energy score */
export function findPeakHour(dataPoints: EnergyDataPoint[]): number {
  let peak = 0
  let peakScore = -1
  for (const dp of dataPoints) {
    if (dp.score > peakScore) {
      peakScore = dp.score
      peak = dp.timestamp
    }
  }
  return peak
}

/**
 * Find the next upcoming peak hour that hasn't passed yet.
 * Looks for the highest-scoring hour in the future (wraps around midnight).
 */
export function findBestTimeToVisit(dataPoints: EnergyDataPoint[], currentHour: number): number {
  // Get future hours (after currentHour, wrapping around)
  const futurePoints = dataPoints.filter(dp => dp.timestamp > currentHour)

  if (futurePoints.length === 0) {
    // All hours have passed; wrap to tomorrow — pick the global peak
    return findPeakHour(dataPoints)
  }

  let best = futurePoints[0]
  for (const dp of futurePoints) {
    if (dp.score > best.score) best = dp
  }
  return best.timestamp
}

/** Determine the current energy trend based on recent and upcoming hours */
export function calculateTrend(dataPoints: EnergyDataPoint[], currentHour: number): EnergyTrend {
  const current = dataPoints[currentHour].score
  const prevHour = (currentHour - 1 + 24) % 24
  const nextHour = (currentHour + 1) % 24
  const prev = dataPoints[prevHour].score
  const next = dataPoints[nextHour].score

  // Quiet if score is low
  if (current < 15) return 'quiet'

  // Peaking if this is roughly the highest nearby
  if (current >= prev && current >= next && current > 30) return 'peaking'

  // Rising if trending up
  if (current > prev && next >= current) return 'rising'

  // Falling if trending down
  if (current < prev) return 'falling'

  return current >= 30 ? 'rising' : 'quiet'
}

/**
 * Simulate a comparison with last week.
 * Uses day of week to create deterministic variation.
 */
export function compareToLastWeek(currentHistory: EnergyDataPoint[], dayOfWeek: number): string {
  // Use day-of-week to seed a deterministic percentage
  const variations = [-18, -8, 5, 12, -3, 22, 15]
  const pct = variations[dayOfWeek % 7]
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = dayNames[dayOfWeek % 7]

  if (pct > 0) return `+${pct}% busier than last ${dayName}`
  if (pct < 0) return `${pct}% quieter than last ${dayName}`
  return `Same as last ${dayName}`
}

/**
 * Forecast energy for the next N hours from the current data.
 * Returns a slice of the data points starting from the current hour.
 */
export function getEnergyForecast(history: VenueEnergyHistory, hoursAhead: number): EnergyDataPoint[] {
  const currentIdx = history.dataPoints.findIndex(dp => dp.isCurrentHour)
  if (currentIdx === -1) return []

  const forecast: EnergyDataPoint[] = []
  for (let i = 1; i <= hoursAhead; i++) {
    const idx = (currentIdx + i) % 24
    forecast.push({ ...history.dataPoints[idx], isCurrentHour: false })
  }
  return forecast
}

/**
 * Apply simple moving-average smoothing to produce natural-looking curves.
 * Uses a 3-point window to reduce sharp jumps.
 */
export function smoothDataPoints(points: EnergyDataPoint[]): EnergyDataPoint[] {
  const n = points.length
  if (n <= 2) return points.map(p => ({ ...p }))

  return points.map((point, i) => {
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const smoothedScore = Math.round((prev.score * 0.25 + point.score * 0.5 + next.score * 0.25))
    const smoothedCheckins = Math.round((prev.checkinCount * 0.25 + point.checkinCount * 0.5 + next.checkinCount * 0.25))

    return {
      ...point,
      score: Math.max(0, Math.min(100, smoothedScore)),
      checkinCount: Math.max(0, smoothedCheckins),
    }
  })
}
