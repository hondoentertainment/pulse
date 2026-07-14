import type { EnergyRating, Pulse, Venue } from './types'
import { PULSE_DECAY_MINUTES } from './types'
import type { EnergyTrend, SignalConfidence } from './decision-explanations'
import { isVenueSignalSuppressed } from './signal-suppress'

/** Versioned signal model — bump when thresholds or decay change (PRD §5). */
export const VENUE_SIGNAL_MODEL_VERSION = '1.0.0'

export interface VenueSignalModelConfig {
  version: string
  decayMinutes: number
  confidence: {
    high: { minReports: number; maxFreshnessMinutes: number }
    medium: { minReports: number; maxFreshnessMinutes: number }
    low: { minReports: number; maxFreshnessMinutes: number }
  }
  trendDeltaThreshold: number
}

export const DEFAULT_SIGNAL_MODEL: VenueSignalModelConfig = {
  version: VENUE_SIGNAL_MODEL_VERSION,
  decayMinutes: PULSE_DECAY_MINUTES,
  confidence: {
    high: { minReports: 3, maxFreshnessMinutes: 45 },
    medium: { minReports: 2, maxFreshnessMinutes: 60 },
    low: { minReports: 1, maxFreshnessMinutes: 90 },
  },
  trendDeltaThreshold: 0.4,
}

export interface VenueSignal {
  venueId: string
  confidence: SignalConfidence
  trend: EnergyTrend
  freshnessMinutes: number | null
  reportCount: number
  modelVersion: string
  sourceMix: { pulses: number; venueMeta: number }
}

function recentPulsesForVenue(
  venueId: string,
  pulses: Pulse[],
  decayMinutes: number,
  now: number,
): Pulse[] {
  const cutoff = now - decayMinutes * 60 * 1000
  return pulses.filter(
    (p) => p.venueId === venueId && new Date(p.createdAt).getTime() >= cutoff,
  )
}

export function deriveSignalConfidence(
  reportCount: number,
  freshnessMinutes: number | null,
  config: VenueSignalModelConfig = DEFAULT_SIGNAL_MODEL,
): SignalConfidence {
  if (reportCount === 0 || freshnessMinutes === null) return 'none'
  const { high, medium, low } = config.confidence
  if (reportCount >= high.minReports && freshnessMinutes <= high.maxFreshnessMinutes) return 'high'
  if (reportCount >= medium.minReports && freshnessMinutes <= medium.maxFreshnessMinutes) return 'medium'
  if (reportCount >= low.minReports && freshnessMinutes <= low.maxFreshnessMinutes) return 'low'
  return 'none'
}

export function deriveSignalTrend(
  venueId: string,
  pulses: Pulse[],
  config: VenueSignalModelConfig = DEFAULT_SIGNAL_MODEL,
  now: number = Date.now(),
): EnergyTrend {
  const recent = recentPulsesForVenue(venueId, pulses, config.decayMinutes, now)
  if (recent.length < 2) return 'unknown'
  const sorted = [...recent].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2))
  const secondHalf = sorted.slice(Math.ceil(sorted.length / 2))
  const avgEnergy = (items: Pulse[]) => {
    if (items.length === 0) return 0
    const map: Record<EnergyRating, number> = {
      dead: 1,
      chill: 2,
      buzzing: 3,
      electric: 4,
    }
    return items.reduce((sum, p) => sum + map[p.energyRating], 0) / items.length
  }
  const delta = avgEnergy(secondHalf) - avgEnergy(firstHalf)
  if (delta >= config.trendDeltaThreshold) return 'rising'
  if (delta <= -config.trendDeltaThreshold) return 'fading'
  return 'steady'
}

export function getSignalFreshness(
  venue: Venue,
  pulses: Pulse[],
  config: VenueSignalModelConfig = DEFAULT_SIGNAL_MODEL,
  now: number = Date.now(),
): { minutes: number | null; reportCount: number; sourceMix: VenueSignal['sourceMix'] } {
  const recent = recentPulsesForVenue(venue.id, pulses, config.decayMinutes, now)
  if (recent.length > 0) {
    const latest = Math.max(...recent.map((p) => new Date(p.createdAt).getTime()))
    return {
      minutes: Math.max(0, Math.round((now - latest) / 60000)),
      reportCount: recent.length,
      sourceMix: { pulses: recent.length, venueMeta: 0 },
    }
  }
  const stamps = [venue.lastPulseAt, venue.lastActivity].filter(Boolean) as string[]
  if (stamps.length === 0) {
    return { minutes: null, reportCount: 0, sourceMix: { pulses: 0, venueMeta: 0 } }
  }
  const latest = Math.max(...stamps.map((s) => new Date(s).getTime()))
  return {
    minutes: Math.max(0, Math.round((now - latest) / 60000)),
    reportCount: 0,
    sourceMix: { pulses: 0, venueMeta: 1 },
  }
}

export function computeVenueSignal(
  venue: Venue,
  pulses: Pulse[],
  options: { config?: VenueSignalModelConfig; now?: Date } = {},
): VenueSignal {
  if (isVenueSignalSuppressed(venue)) {
    return {
      venueId: venue.id,
      confidence: 'none',
      trend: 'unknown',
      freshnessMinutes: null,
      reportCount: 0,
      modelVersion: (options.config ?? DEFAULT_SIGNAL_MODEL).version,
      sourceMix: { pulses: 0, venueMeta: 0 },
    }
  }

  const config = options.config ?? DEFAULT_SIGNAL_MODEL
  const now = options.now?.getTime() ?? Date.now()
  const { minutes, reportCount, sourceMix } = getSignalFreshness(venue, pulses, config, now)
  return {
    venueId: venue.id,
    confidence: deriveSignalConfidence(reportCount, minutes, config),
    trend: deriveSignalTrend(venue.id, pulses, config, now),
    freshnessMinutes: minutes,
    reportCount,
    modelVersion: config.version,
    sourceMix,
  }
}
