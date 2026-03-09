import type { Pulse, Venue, EnergyRating } from './types'

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
}

const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

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
    return { venueId, predictedPeakTime: '9PM', predictedEnergyLevel: 'chill', confidence: 0.1, label: 'Not enough data', basedOn: 'historical' }
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
  }
}

export function applyWeatherModifier(prediction: SurgePrediction, weather: WeatherCondition): SurgePrediction {
  let cAdj = 0, eAdj = 0
  if (weather === 'rainy' || weather === 'snowy') { cAdj = -0.15; eAdj = -0.5 }
  else if (weather === 'clear') { cAdj = 0.05; eAdj = 0.3 }
  else if (weather === 'hot') { cAdj = 0.03; eAdj = 0.2 }
  else if (weather === 'cold') { cAdj = -0.05; eAdj = -0.2 }
  const idx = ENERGY_LABELS.indexOf(prediction.predictedEnergyLevel)
  const newIdx = Math.max(0, Math.min(3, Math.round(idx + eAdj)))
  return { ...prediction, confidence: Math.max(0.05, Math.min(0.95, prediction.confidence + cAdj)), predictedEnergyLevel: ENERGY_LABELS[newIdx], basedOn: 'combined' }
}

export function applyEventModifier(prediction: SurgePrediction, rsvpCount: number): SurgePrediction {
  if (rsvpCount <= 0) return prediction
  const boost = Math.min(0.3, rsvpCount / 100)
  const idx = ENERGY_LABELS.indexOf(prediction.predictedEnergyLevel)
  const eBoost = rsvpCount >= 30 ? 1 : rsvpCount >= 10 ? 0.5 : 0
  return { ...prediction, confidence: Math.min(0.95, prediction.confidence + boost), predictedEnergyLevel: ENERGY_LABELS[Math.min(3, Math.round(idx + eBoost))], basedOn: 'combined' }
}

export function generateSmartNotification(venueName: string, prediction: SurgePrediction): string {
  if (prediction.confidence < 0.2) return `${venueName} might pick up later tonight`
  return `Based on patterns, ${venueName} usually surges around ${prediction.predictedPeakTime}`
}

export function getVenuesThatWillSurge(venues: Venue[], patterns: VenuePattern[], currentHour: number, dayOfWeek: number, limit: number = 5): SurgePrediction[] {
  return venues.map(v => ({ ...predictSurge(v.id, patterns, currentHour, dayOfWeek), venueName: v.name }))
    .filter(p => p.confidence > 0.15).sort((a, b) => b.confidence - a.confidence).slice(0, limit)
}

export function calculatePredictionAccuracy(predictions: SurgePrediction[], actualPulses: Pulse[]): { total: number; correct: number; accuracy: number } {
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
