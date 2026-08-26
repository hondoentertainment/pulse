import type { VenueSignal, VenueSignalConfidence } from './venue-signal'
import type { Venue } from './types'

export type WorthGoingVerdict = 'go' | 'maybe' | 'wait' | 'unknown'

export interface WorthGoingSummary {
  verdict: WorthGoingVerdict
  headline: string
  confidence: VenueSignalConfidence
  freshness: string
  friction: string
  sourceMix: string
  reasons: string[]
}

function freshnessCopy(minutes: number | null): string {
  if (minutes === null) return 'No live freshness yet'
  if (minutes <= 10) return `Fresh · ${minutes}m ago`
  if (minutes <= 30) return `Warm · ${minutes}m ago`
  if (minutes <= 90) return `Aging · ${minutes}m ago`
  return `Stale · ${minutes}m ago`
}

function sourceMixCopy(signal: VenueSignal): string {
  const parts: string[] = []
  if (signal.sourceMix.pulses > 0) {
    parts.push(`${signal.sourceMix.pulses} pulse${signal.sourceMix.pulses === 1 ? '' : 's'}`)
  }
  if (signal.sourceMix.liveReports > 0) {
    parts.push(`${signal.sourceMix.liveReports} live report${signal.sourceMix.liveReports === 1 ? '' : 's'}`)
  }
  if (parts.length === 0 && signal.sourceMix.curatedSeed) {
    return 'Curated seed listing · no live reports yet'
  }
  if (parts.length === 0) return 'No live sources yet'
  return parts.join(' + ')
}

export function buildWorthGoingSummary(signal: VenueSignal, venue?: Venue): WorthGoingSummary {
  const hasLive = signal.sourceMix.pulses > 0 || signal.sourceMix.liveReports > 0
  const highFriction =
    (signal.friction.waitMinutes !== null && signal.friction.waitMinutes > 20) ||
    signal.friction.lineStatus === 'door-risk'

  let verdict: WorthGoingVerdict = 'unknown'
  if (!hasLive) {
    verdict = 'unknown'
  } else if (highFriction && signal.energyScore < 70) {
    verdict = 'wait'
  } else if (signal.energyScore >= 60 && signal.confidence !== 'low' && !highFriction) {
    verdict = 'go'
  } else if (signal.energyScore >= 35 || signal.confidence !== 'low') {
    verdict = 'maybe'
  } else {
    verdict = 'wait'
  }

  const headlines: Record<WorthGoingVerdict, string> = {
    go: 'Worth going',
    maybe: 'Worth a look',
    wait: 'Wait it out',
    unknown: 'Not enough live signal',
  }

  const reasons: string[] = []
  if (venue?.neighborhood) reasons.push(venue.neighborhood)
  reasons.push(`${signal.energyLabel} · ${signal.energyScore}`)
  reasons.push(signal.trend === 'unknown' ? 'Trend unknown' : `Trend ${signal.trend}`)
  reasons.push(`Confidence ${signal.confidence}`)

  return {
    verdict,
    headline: headlines[verdict],
    confidence: signal.confidence,
    freshness: freshnessCopy(signal.freshnessMinutes),
    friction: signal.friction.label,
    sourceMix: sourceMixCopy(signal),
    reasons,
  }
}
