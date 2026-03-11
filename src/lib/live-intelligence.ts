import type { Venue } from './types'
import { calculateDistance } from './pulse-engine'

// --- Types ---

export type DressCode = 'casual' | 'smart-casual' | 'dressy' | 'formal'
export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface NowPlaying {
  track: string
  artist: string
}

export interface VenueLiveData {
  venueId: string
  timestamp: string
  crowdLevel: number // 0-100 percentage
  waitTime: number | null // minutes at door
  coverCharge: number | null // dollar amount, null = free
  coverChargeNote?: string // e.g. "Free before 11pm"
  dressCode: DressCode | null
  musicGenre: string | null
  nowPlaying: NowPlaying | null
  ageRange: { min: number; max: number; average: number } | null
  capacity: { current: number; max: number; percentFull: number } | null
  lastUpdated: string
  confidence: Record<string, ConfidenceLevel>
}

export interface LiveReport {
  id: string
  venueId: string
  userId: string
  type: 'wait_time' | 'cover_charge' | 'music' | 'crowd_level' | 'dress_code' | 'now_playing' | 'age_range'
  value: unknown
  createdAt: string
}

export interface HeatmapCell {
  lat: number
  lng: number
  intensity: number // 0-100
  venueCount: number
  topVenueId?: string
}

// --- In-memory store ---

let reportStore: LiveReport[] = []

function generateId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// --- Report functions ---

export function reportWaitTime(venueId: string, userId: string, minutes: number): LiveReport {
  const report: LiveReport = {
    id: generateId(),
    venueId,
    userId,
    type: 'wait_time',
    value: minutes,
    createdAt: new Date().toISOString(),
  }
  reportStore.push(report)
  return report
}

export function reportCoverCharge(
  venueId: string,
  userId: string,
  amount: number | null,
  note?: string
): LiveReport {
  const report: LiveReport = {
    id: generateId(),
    venueId,
    userId,
    type: 'cover_charge',
    value: { amount, note },
    createdAt: new Date().toISOString(),
  }
  reportStore.push(report)
  return report
}

export function reportMusicPlaying(
  venueId: string,
  userId: string,
  genre: string
): LiveReport {
  const report: LiveReport = {
    id: generateId(),
    venueId,
    userId,
    type: 'music',
    value: genre,
    createdAt: new Date().toISOString(),
  }
  reportStore.push(report)
  return report
}

export function reportCrowdLevel(
  venueId: string,
  userId: string,
  level: number
): LiveReport {
  const report: LiveReport = {
    id: generateId(),
    venueId,
    userId,
    type: 'crowd_level',
    value: Math.max(0, Math.min(100, level)),
    createdAt: new Date().toISOString(),
  }
  reportStore.push(report)
  return report
}

export function reportDressCode(
  venueId: string,
  userId: string,
  code: DressCode
): LiveReport {
  const report: LiveReport = {
    id: generateId(),
    venueId,
    userId,
    type: 'dress_code',
    value: code,
    createdAt: new Date().toISOString(),
  }
  reportStore.push(report)
  return report
}

export function reportNowPlaying(
  venueId: string,
  userId: string,
  track: string,
  artist: string
): LiveReport {
  const report: LiveReport = {
    id: generateId(),
    venueId,
    userId,
    type: 'now_playing',
    value: { track, artist },
    createdAt: new Date().toISOString(),
  }
  reportStore.push(report)
  return report
}

export function reportAgeRange(
  venueId: string,
  userId: string,
  min: number,
  max: number
): LiveReport {
  const report: LiveReport = {
    id: generateId(),
    venueId,
    userId,
    type: 'age_range',
    value: { min, max },
    createdAt: new Date().toISOString(),
  }
  reportStore.push(report)
  return report
}

// --- Aggregation helpers ---

const REPORT_WINDOW_MS = 30 * 60 * 1000 // 30 minutes

function getRecentReports(venueId: string, type?: LiveReport['type']): LiveReport[] {
  const cutoff = Date.now() - REPORT_WINDOW_MS
  return reportStore.filter(
    r =>
      r.venueId === venueId &&
      (!type || r.type === type) &&
      new Date(r.createdAt).getTime() > cutoff
  )
}

function recencyWeight(report: LiveReport): number {
  const age = Date.now() - new Date(report.createdAt).getTime()
  // Linear decay: 1.0 at time=0 -> 0.1 at 30 minutes
  return Math.max(0.1, 1 - (age / REPORT_WINDOW_MS) * 0.9)
}

function computeConfidence(reports: LiveReport[]): ConfidenceLevel {
  if (reports.length === 0) return 'low'
  const totalWeight = reports.reduce((sum, r) => sum + recencyWeight(r), 0)
  if (reports.length >= 5 && totalWeight >= 3) return 'high'
  if (reports.length >= 2 && totalWeight >= 1) return 'medium'
  return 'low'
}

function weightedAverage(reports: LiveReport[]): number {
  if (reports.length === 0) return 0
  let totalWeight = 0
  let totalValue = 0
  for (const r of reports) {
    const w = recencyWeight(r)
    totalWeight += w
    totalValue += (r.value as number) * w
  }
  return totalWeight > 0 ? totalValue / totalWeight : 0
}

function mostReportedValue<T>(reports: LiveReport[]): T | null {
  if (reports.length === 0) return null
  const counts = new Map<string, { count: number; value: T }>()
  for (const r of reports) {
    const key = JSON.stringify(r.value)
    const existing = counts.get(key)
    if (existing) {
      existing.count += recencyWeight(r)
    } else {
      counts.set(key, { count: recencyWeight(r), value: r.value as T })
    }
  }
  let best: { count: number; value: T } | null = null
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry
  }
  return best ? best.value : null
}

// --- Main aggregation ---

export function getVenueLiveData(venueId: string): VenueLiveData {
  const now = new Date().toISOString()

  const waitReports = getRecentReports(venueId, 'wait_time')
  const coverReports = getRecentReports(venueId, 'cover_charge')
  const musicReports = getRecentReports(venueId, 'music')
  const crowdReports = getRecentReports(venueId, 'crowd_level')
  const dressReports = getRecentReports(venueId, 'dress_code')
  const nowPlayingReports = getRecentReports(venueId, 'now_playing')
  const ageReports = getRecentReports(venueId, 'age_range')

  // Wait time: weighted average
  const waitTime = waitReports.length > 0 ? Math.round(weightedAverage(waitReports)) : null

  // Cover charge: most recent consensus
  let coverCharge: number | null = null
  let coverChargeNote: string | undefined
  if (coverReports.length > 0) {
    const bestCover = mostReportedValue<{ amount: number | null; note?: string }>(coverReports)
    if (bestCover) {
      coverCharge = bestCover.amount
      coverChargeNote = bestCover.note
    }
  }

  // Music genre: most reported
  const musicGenre = musicReports.length > 0
    ? mostReportedValue<string>(musicReports)
    : null

  // Crowd level: weighted average
  const crowdLevel = crowdReports.length > 0
    ? Math.round(weightedAverage(crowdReports))
    : 0

  // Dress code: most reported
  const dressCode = dressReports.length > 0
    ? mostReportedValue<DressCode>(dressReports)
    : null

  // Now playing: most reported wins consensus
  const nowPlaying = nowPlayingReports.length > 0
    ? mostReportedValue<NowPlaying>(nowPlayingReports)
    : null

  // Age range: average of reported ranges
  let ageRange: VenueLiveData['ageRange'] = null
  if (ageReports.length > 0) {
    let totalMin = 0, totalMax = 0, count = 0
    for (const r of ageReports) {
      const val = r.value as { min: number; max: number }
      totalMin += val.min
      totalMax += val.max
      count++
    }
    const avgMin = Math.round(totalMin / count)
    const avgMax = Math.round(totalMax / count)
    ageRange = { min: avgMin, max: avgMax, average: Math.round((avgMin + avgMax) / 2) }
  }

  // Capacity estimate from crowd level
  const capacity = crowdLevel > 0
    ? {
        current: Math.round(crowdLevel * 3), // rough estimate
        max: 300,
        percentFull: crowdLevel,
      }
    : null

  const confidence: Record<string, ConfidenceLevel> = {
    waitTime: computeConfidence(waitReports),
    coverCharge: computeConfidence(coverReports),
    musicGenre: computeConfidence(musicReports),
    crowdLevel: computeConfidence(crowdReports),
    dressCode: computeConfidence(dressReports),
    nowPlaying: computeConfidence(nowPlayingReports),
    ageRange: computeConfidence(ageReports),
  }

  // lastUpdated = most recent report timestamp
  const allReports = getRecentReports(venueId)
  const lastUpdated = allReports.length > 0
    ? allReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
    : now

  return {
    venueId,
    timestamp: now,
    crowdLevel,
    waitTime,
    coverCharge,
    coverChargeNote,
    dressCode,
    musicGenre,
    nowPlaying,
    ageRange,
    capacity,
    lastUpdated,
    confidence,
  }
}

// --- Crowd forecast ---

export function forecastCrowdLevel(venueId: string, targetTime: Date): {
  predicted: number
  confidence: ConfidenceLevel
  label: string
} {
  const crowdReports = getRecentReports(venueId, 'crowd_level')
  if (crowdReports.length < 2) {
    return { predicted: 0, confidence: 'low', label: 'Not enough data' }
  }

  // Sort by time
  const sorted = [...crowdReports].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Calculate trend (slope of crowd level over time)
  const firstTime = new Date(sorted[0].createdAt).getTime()
  const lastTime = new Date(sorted[sorted.length - 1].createdAt).getTime()
  const firstLevel = sorted[0].value as number
  const lastLevel = sorted[sorted.length - 1].value as number

  const timeDiffMins = (lastTime - firstTime) / 60000
  if (timeDiffMins <= 0) {
    return { predicted: lastLevel, confidence: 'low', label: 'Steady' }
  }

  const slope = (lastLevel - firstLevel) / timeDiffMins // change per minute
  const forecastMins = (targetTime.getTime() - Date.now()) / 60000
  const predicted = Math.max(0, Math.min(100, Math.round(lastLevel + slope * forecastMins)))

  // Apply day-of-week pattern adjustments
  const targetHour = targetTime.getHours()
  let hourMultiplier = 1
  if (targetHour >= 22 || targetHour <= 1) hourMultiplier = 1.3 // peak hours
  else if (targetHour >= 20) hourMultiplier = 1.1
  else if (targetHour <= 18) hourMultiplier = 0.7

  const adjustedPredicted = Math.max(0, Math.min(100, Math.round(predicted * hourMultiplier)))

  let label: string
  if (adjustedPredicted >= 80) label = 'Expected to be packed'
  else if (adjustedPredicted >= 60) label = 'Getting busy'
  else if (adjustedPredicted >= 40) label = 'Moderate crowd expected'
  else if (adjustedPredicted >= 20) label = 'Should be chill'
  else label = 'Likely quiet'

  return {
    predicted: adjustedPredicted,
    confidence: crowdReports.length >= 5 ? 'high' : 'medium',
    label,
  }
}

// --- Wait time estimation ---

export function estimateWaitTime(venueId: string): {
  minutes: number | null
  confidence: ConfidenceLevel
  label: string
} {
  const waitReports = getRecentReports(venueId, 'wait_time')

  if (waitReports.length > 0) {
    const avg = Math.round(weightedAverage(waitReports))
    return {
      minutes: avg,
      confidence: computeConfidence(waitReports),
      label: avg === 0 ? 'No wait' : `~${avg} min`,
    }
  }

  // Fallback: estimate from crowd level
  const crowdReports = getRecentReports(venueId, 'crowd_level')
  if (crowdReports.length > 0) {
    const crowdLevel = Math.round(weightedAverage(crowdReports))
    // Correlate crowd to wait: 80%+ crowd ~ 15-30 min wait
    let estimatedWait = 0
    if (crowdLevel >= 90) estimatedWait = 30
    else if (crowdLevel >= 80) estimatedWait = 20
    else if (crowdLevel >= 70) estimatedWait = 15
    else if (crowdLevel >= 60) estimatedWait = 10
    else if (crowdLevel >= 40) estimatedWait = 5
    else estimatedWait = 0

    return {
      minutes: estimatedWait,
      confidence: 'low',
      label: estimatedWait === 0 ? 'No wait (est.)' : `~${estimatedWait} min (est.)`,
    }
  }

  return { minutes: null, confidence: 'low', label: 'No data' }
}

// --- City heatmap ---

export function getCityHeatmap(
  location: { lat: number; lng: number },
  radiusMiles: number,
  venues: Venue[]
): HeatmapCell[] {
  const gridSize = 10 // 10x10 grid
  const cells: HeatmapCell[] = []

  const latRange = radiusMiles / 69 // ~69 miles per degree of latitude
  const lngRange = radiusMiles / (69 * Math.cos(location.lat * Math.PI / 180))

  const latStep = (latRange * 2) / gridSize
  const lngStep = (lngRange * 2) / gridSize

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const cellLat = location.lat - latRange + i * latStep + latStep / 2
      const cellLng = location.lng - lngRange + j * lngStep + lngStep / 2

      // Find venues within this cell
      const cellVenues = venues.filter(v => {
        const dist = calculateDistance(cellLat, cellLng, v.location.lat, v.location.lng)
        return dist <= (radiusMiles / gridSize) * 1.5
      })

      if (cellVenues.length === 0) {
        cells.push({ lat: cellLat, lng: cellLng, intensity: 0, venueCount: 0 })
        continue
      }

      // Intensity = weighted average of pulse scores
      const totalScore = cellVenues.reduce((sum, v) => sum + v.pulseScore, 0)
      const avgScore = totalScore / cellVenues.length
      const densityBoost = Math.min(20, cellVenues.length * 5) // more venues = more intense
      const intensity = Math.min(100, Math.round(avgScore + densityBoost))

      const topVenue = cellVenues.sort((a, b) => b.pulseScore - a.pulseScore)[0]

      cells.push({
        lat: cellLat,
        lng: cellLng,
        intensity,
        venueCount: cellVenues.length,
        topVenueId: topVenue.id,
      })
    }
  }

  return cells
}

// --- Seed demo data ---

export function seedDemoReports(venueIds: string[]): void {
  const now = Date.now()
  const demoUserId = 'demo-reporter'

  for (const venueId of venueIds) {
    // Seed with varied data to make it interesting
    const hash = venueId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const crowdBase = 30 + (hash % 60) // 30-90
    const waitBase = Math.floor((hash % 4) * 5) // 0, 5, 10, 15

    for (let i = 0; i < 3; i++) {
      const offset = i * 8 * 60 * 1000 // spread reports over ~16 minutes
      const timestamp = new Date(now - offset).toISOString()
      const jitter = (Math.random() - 0.5) * 10

      reportStore.push({
        id: generateId(),
        venueId,
        userId: `${demoUserId}-${i}`,
        type: 'crowd_level',
        value: Math.max(0, Math.min(100, Math.round(crowdBase + jitter))),
        createdAt: timestamp,
      })

      reportStore.push({
        id: generateId(),
        venueId,
        userId: `${demoUserId}-${i}`,
        type: 'wait_time',
        value: Math.max(0, waitBase + Math.round(jitter / 3)),
        createdAt: timestamp,
      })
    }

    // One cover charge report
    const coverAmount = hash % 3 === 0 ? null : (hash % 4 + 1) * 5
    reportStore.push({
      id: generateId(),
      venueId,
      userId: demoUserId,
      type: 'cover_charge',
      value: { amount: coverAmount, note: coverAmount === null ? 'Free all night' : undefined },
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
    })

    // Dress code
    const dressOptions: DressCode[] = ['casual', 'smart-casual', 'dressy', 'formal']
    reportStore.push({
      id: generateId(),
      venueId,
      userId: demoUserId,
      type: 'dress_code',
      value: dressOptions[hash % dressOptions.length],
      createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    })

    // Music genre
    const genres = ['House', 'Hip-Hop', 'Top 40', 'R&B', 'Latin', 'Techno', 'Jazz', 'Rock']
    reportStore.push({
      id: generateId(),
      venueId,
      userId: demoUserId,
      type: 'music',
      value: genres[hash % genres.length],
      createdAt: new Date(now - 3 * 60 * 1000).toISOString(),
    })

    // Now playing
    const tracks = [
      { track: 'Blinding Lights', artist: 'The Weeknd' },
      { track: 'Levitating', artist: 'Dua Lipa' },
      { track: 'Industry Baby', artist: 'Lil Nas X' },
      { track: 'Heat Waves', artist: 'Glass Animals' },
      { track: 'Save Your Tears', artist: 'The Weeknd' },
    ]
    reportStore.push({
      id: generateId(),
      venueId,
      userId: demoUserId,
      type: 'now_playing',
      value: tracks[hash % tracks.length],
      createdAt: new Date(now - 2 * 60 * 1000).toISOString(),
    })

    // Age range
    const ageMin = 21 + (hash % 5)
    reportStore.push({
      id: generateId(),
      venueId,
      userId: demoUserId,
      type: 'age_range',
      value: { min: ageMin, max: ageMin + 10 + (hash % 5) },
      createdAt: new Date(now - 7 * 60 * 1000).toISOString(),
    })
  }
}

// --- Utility to clear reports (for testing) ---

export function clearReports(): void {
  reportStore = []
}

// --- Get all reports for a venue (for UI display) ---

export function getReportCount(venueId: string): number {
  return getRecentReports(venueId).length
}
