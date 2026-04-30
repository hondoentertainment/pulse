import type { Pulse, Venue, EnergyRating } from './types'
import type { VenueEvent } from './events'
import { getRSVPCounts, predictEventSurge } from './events'

/**
 * Predictive Surge Engine (Phase 6.1)
 */

export type WeatherCondition = 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'hot' | 'cold'

export interface VenuePattern {
  venueId: string
  dayOfWeek: number
  hourDistribution: Record<number, { avgPulseCount: number; avgEnergy: number }>
  typicalPeakHour: number
  typicalPeakEnergy: EnergyRating
}

export interface SurgePrediction {
  venueId: string
  venueName?: string
  predictedPeakTime: string
  predictedEnergyLevel: EnergyRating
  confidence: number
  label: string
  basedOn: 'historical' | 'event' | 'weather' | 'combined'
  momentumScore: number
  signals: PredictionSignal[]
}

export interface PredictionSignal {
  source: 'historical' | 'event' | 'social' | 'music'
  label: string
  strength: number
}

type SurgePredictionInput = Omit<SurgePrediction, 'momentumScore' | 'signals'> &
  Partial<Pick<SurgePrediction, 'momentumScore' | 'signals'>>

const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

function normalizeSurgePrediction(prediction: SurgePredictionInput): SurgePrediction {
  return {
    ...prediction,
    momentumScore: prediction.momentumScore ?? Math.round(Math.max(0, Math.min(100, prediction.confidence * 100))),
    signals: prediction.signals ?? [],
  }
}

export function analyzeVenuePatterns(venueId: string, pulses: Pulse[], windowDays: number = 30): VenuePattern[] {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const venuePulses = pulses.filter(p => p.venueId === venueId && new Date(p.createdAt).getTime() > cutoff)
  const byDay = new Map<number, Pulse[]>()
  for (const p of venuePulses) {
    const dow = new Date(p.createdAt).getDay()
    if (!byDay.has(dow)) byDay.set(dow, [])
    byDay.get(dow)!.push(p)
  }
  const weeksInWindow = Math.max(1, Math.ceil(windowDays / 7))
  const patterns: VenuePattern[] = []
  for (const [dow, dayPulses] of byDay) {
    const hourBuckets: Record<number, { count: number; energy: number }> = {}
    for (const p of dayPulses) {
      const h = new Date(p.createdAt).getHours()
      if (!hourBuckets[h]) hourBuckets[h] = { count: 0, energy: 0 }
      hourBuckets[h].count++
      hourBuckets[h].energy += ENERGY_VALUES[p.energyRating]
    }
    const distribution: Record<number, { avgPulseCount: number; avgEnergy: number }> = {}
    let peakHour = 0, peakAvg = 0
    for (const [hStr, d] of Object.entries(hourBuckets)) {
      const h = Number(hStr)
      const avg = d.count / weeksInWindow
      const avgE = d.count > 0 ? d.energy / d.count : 0
      distribution[h] = { avgPulseCount: Math.round(avg * 100) / 100, avgEnergy: Math.round(avgE * 100) / 100 }
      if (avg > peakAvg) { peakAvg = avg; peakHour = h }
    }
    const peakE = distribution[peakHour]?.avgEnergy ?? 1
    patterns.push({
      venueId, dayOfWeek: dow, hourDistribution: distribution,
      typicalPeakHour: peakHour,
      typicalPeakEnergy: ENERGY_LABELS[Math.round(Math.min(3, peakE))],
    })
  }
  return patterns
}

export function predictSurge(venueId: string, patterns: VenuePattern[], currentHour: number, dayOfWeek: number): SurgePrediction {
  const pat = patterns.find(p => p.venueId === venueId && p.dayOfWeek === dayOfWeek)
  if (!pat || Object.keys(pat.hourDistribution).length === 0) {
    return {
      venueId,
      predictedPeakTime: '9PM',
      predictedEnergyLevel: 'chill',
      confidence: 0.1,
      label: 'Not enough data',
      basedOn: 'historical',
      momentumScore: 10,
      signals: [{ source: 'historical', label: 'Limited history', strength: 0.1 }],
    }
  }
  let bestHour = pat.typicalPeakHour, bestCount = 0
  for (const [hStr, d] of Object.entries(pat.hourDistribution)) {
    const h = Number(hStr)
    if (h > currentHour && d.avgPulseCount > bestCount) { bestCount = d.avgPulseCount; bestHour = h }
  }
  if (bestCount === 0) bestHour = pat.typicalPeakHour
  const energy = pat.hourDistribution[bestHour]?.avgEnergy ?? 1
  const predictedEnergy = ENERGY_LABELS[Math.round(Math.min(3, energy))]
  const dataPoints = Object.values(pat.hourDistribution).reduce((s, d) => s + d.avgPulseCount, 0)
  const confidence = Math.min(0.95, Math.round((dataPoints / 20) * 100) / 100)
  const hoursUntil = bestHour > currentHour ? bestHour - currentHour : bestHour + 24 - currentHour
  return {
    venueId, predictedPeakTime: formatHour(bestHour), predictedEnergyLevel: predictedEnergy,
    confidence, basedOn: 'historical',
    label: hoursUntil <= 1 ? `Expected to be ${cap(predictedEnergy)} soon` : `Expected to peak at ${formatHour(bestHour)}`,
    momentumScore: Math.round(Math.min(100, confidence * 100)),
    signals: [{
      source: 'historical',
      label: `Usually peaks around ${formatHour(bestHour)}`,
      strength: confidence,
    }],
  }
}

export function applyWeatherModifier(prediction: SurgePredictionInput, weather: WeatherCondition): SurgePrediction {
  const basePrediction = normalizeSurgePrediction(prediction)
  let cAdj = 0, eAdj = 0
  if (weather === 'rainy' || weather === 'snowy') { cAdj = -0.15; eAdj = -0.5 }
  else if (weather === 'clear') { cAdj = 0.05; eAdj = 0.3 }
  else if (weather === 'hot') { cAdj = 0.03; eAdj = 0.2 }
  else if (weather === 'cold') { cAdj = -0.05; eAdj = -0.2 }
  const idx = ENERGY_LABELS.indexOf(basePrediction.predictedEnergyLevel)
  const newIdx = Math.max(0, Math.min(3, Math.round(idx + eAdj)))
  return {
    ...basePrediction,
    confidence: Math.max(0.05, Math.min(0.95, basePrediction.confidence + cAdj)),
    predictedEnergyLevel: ENERGY_LABELS[newIdx],
    basedOn: 'combined',
    momentumScore: Math.round(Math.min(100, Math.max(0, basePrediction.momentumScore + cAdj * 100))),
  }
}

export function applyEventModifier(prediction: SurgePredictionInput, rsvpCount: number): SurgePrediction {
  const basePrediction = normalizeSurgePrediction(prediction)
  if (rsvpCount <= 0) return basePrediction
  const boost = Math.min(0.3, rsvpCount / 100)
  const idx = ENERGY_LABELS.indexOf(basePrediction.predictedEnergyLevel)
  const eBoost = rsvpCount >= 30 ? 1 : rsvpCount >= 10 ? 0.5 : 0
  return {
    ...basePrediction,
    confidence: Math.min(0.95, basePrediction.confidence + boost),
    predictedEnergyLevel: ENERGY_LABELS[Math.min(3, Math.round(idx + eBoost))],
    basedOn: 'combined',
    momentumScore: Math.round(Math.min(100, basePrediction.momentumScore + boost * 100)),
  }
}

export function generateSmartNotification(venueName: string, prediction: SurgePredictionInput): string {
  const normalizedPrediction = normalizeSurgePrediction(prediction)
  if (normalizedPrediction.confidence < 0.2) return `${venueName} might pick up later tonight`
  const signalHint = normalizedPrediction.signals
    .slice(0, 2)
    .map(signal => signal.label)
    .join(' • ')
  return `${venueName} looks primed for a surge: ${signalHint || `usually surges around ${normalizedPrediction.predictedPeakTime}`}`
}

function getSocialSignal(venue: Venue): PredictionSignal {
  const velocity = venue.scoreVelocity ?? 0
  const strength = Math.max(0.05, Math.min(0.95, (venue.pulseScore / 100) * 0.6 + Math.max(0, velocity) / 40))
  const label = velocity > 10
    ? 'Fast pulse velocity right now'
    : venue.pulseScore >= 70
    ? 'Already drawing real-time energy'
    : 'Steady live activity'

  return {
    source: 'social',
    label,
    strength,
  }
}

function getMusicSignal(venue: Venue, currentHour: number): PredictionSignal | null {
  const category = (venue.category ?? '').toLowerCase()
  const hasMusicProgramming =
    category.includes('music') ||
    category.includes('nightclub') ||
    category.includes('lounge') ||
    Boolean(venue.integrations?.music)

  if (!hasMusicProgramming) return null

  const strength = currentHour >= 20 ? 0.3 : 0.18
  const label = venue.integrations?.music?.playlistName
    ? `Programmed around ${venue.integrations.music.playlistName}`
    : 'Music programming is a tailwind tonight'

  return {
    source: 'music',
    label,
    strength,
  }
}

function getEventSignal(venue: Venue, events: VenueEvent[], now: Date): { signal: PredictionSignal; peakTime?: string; energy?: EnergyRating } | null {
  const upcoming = events
    .filter(event => event.venueId === venue.id)
    .filter(event => {
      const start = new Date(event.startTime).getTime()
      const diff = start - now.getTime()
      return diff >= 0 && diff <= 4 * 60 * 60 * 1000
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]

  if (!upcoming) return null

  const counts = getRSVPCounts(upcoming)
  const prediction = predictEventSurge(upcoming)
  const strength = Math.max(0.2, Math.min(0.95, counts.going / 40 + counts.interested / 120))

  return {
    signal: {
      source: 'event',
      label: `${upcoming.title} has ${counts.going} going`,
      strength,
    },
    peakTime: formatHour(new Date(prediction.predictedPeakTime).getHours()),
    energy: prediction.predictedEnergyLevel,
  }
}

function mergeSignals(
  venue: Venue,
  basePrediction: SurgePrediction,
  events: VenueEvent[],
  currentHour: number,
  now: Date
): SurgePrediction {
  const signals: PredictionSignal[] = [...basePrediction.signals]
  const socialSignal = getSocialSignal(venue)
  signals.push(socialSignal)

  const musicSignal = getMusicSignal(venue, currentHour)
  if (musicSignal) signals.push(musicSignal)

  const eventSignal = getEventSignal(venue, events, now)
  if (eventSignal) signals.push(eventSignal.signal)

  const signalStrength = signals.reduce((sum, signal) => sum + signal.strength, 0)
  const mergedConfidence = Math.max(0.1, Math.min(0.98, basePrediction.confidence * 0.45 + signalStrength * 0.28))
  const topSignals = [...signals].sort((a, b) => b.strength - a.strength)

  const energyIdx = ENERGY_LABELS.indexOf(basePrediction.predictedEnergyLevel)
  const boostedIdx = Math.min(
    3,
    Math.round(
      energyIdx +
      (venue.scoreVelocity ?? 0) / 20 +
      (eventSignal ? 0.8 : 0) +
      (musicSignal ? 0.3 : 0)
    )
  )

  return {
    ...basePrediction,
    predictedPeakTime: eventSignal?.peakTime ?? basePrediction.predictedPeakTime,
    predictedEnergyLevel: eventSignal?.energy ?? ENERGY_LABELS[boostedIdx],
    confidence: mergedConfidence,
    basedOn: topSignals.length > 1 ? 'combined' : topSignals[0]?.source === 'event' ? 'event' : basePrediction.basedOn,
    momentumScore: Math.round(Math.min(100, mergedConfidence * 100 + Math.max(0, venue.scoreVelocity ?? 0))),
    signals: topSignals.slice(0, 4),
    label: topSignals.length > 1
      ? `${topSignals[0].label} • ${topSignals[1].label}`
      : topSignals[0]?.label ?? basePrediction.label,
  }
}

export function getVenuesThatWillSurge(
  venues: Venue[],
  patterns: VenuePattern[],
  currentHour: number,
  dayOfWeek: number,
  limit: number = 5,
  events: VenueEvent[] = [],
  now: Date = new Date()
): SurgePrediction[] {
  return venues
    .map((venue) => {
      const base = { ...predictSurge(venue.id, patterns, currentHour, dayOfWeek), venueName: venue.name }
      return mergeSignals(venue, base, events, currentHour, now)
    })
    .filter(prediction => prediction.confidence > 0.15)
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, limit)
}

export function calculatePredictionAccuracy(
  predictions: Pick<SurgePrediction, 'venueId' | 'predictedPeakTime'>[],
  actualPulses: Pulse[]
): { total: number; correct: number; accuracy: number } {
  let correct = 0
  for (const pred of predictions) {
    const peakHour = parseHour(pred.predictedPeakTime)
    if (actualPulses.some(p => p.venueId === pred.venueId && Math.abs(new Date(p.createdAt).getHours() - peakHour) <= 1)) correct++
  }
  return { total: predictions.length, correct, accuracy: predictions.length > 0 ? correct / predictions.length : 0 }
}

function formatHour(h: number): string { const ap = h >= 12 ? 'PM' : 'AM'; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}${ap}` }
function parseHour(s: string): number { const n = parseInt(s); const pm = s.includes('PM'); return pm ? (n === 12 ? 12 : n + 12) : (n === 12 ? 0 : n) }
function cap(s: string): string { return s[0].toUpperCase() + s.slice(1) }
