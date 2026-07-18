import type { EnergyRating, Pulse, Venue } from './types'
import { ENERGY_CONFIG, PULSE_DECAY_MINUTES } from './types'
import { computeVenueSignal, DEFAULT_SIGNAL_MODEL } from './venue-signal'
import { scoreToEnergyRating } from './pulse-engine'

/** Consumer-facing labels for time-constrained pulse "reviews". */
export const LIVE_REVIEW_LABELS = {
  singular: 'Live review',
  plural: 'Live reviews',
  rightNow: 'Right now',
  empty: 'No live reviews yet',
  leave: 'Leave a live review',
  addPhoto: 'Add photo review',
} as const

export interface LiveReviewProof {
  reportCount: number
  freshnessMinutes: number | null
  dominantEnergy: EnergyRating | null
  energyBreakdown: Partial<Record<EnergyRating, number>>
  /** Scannable Google-Reviews-style line, e.g. "12 said buzzing · last hour" */
  proofLine: string
  /** Compact chip, e.g. "8 reviews · 12m ago" */
  proofChip: string
  /** Worth Going style, e.g. "8 live reviews in 90m · last 12 min" */
  proofSummary: string
  decayWindowMinutes: number
}

function recentPulses(
  venueId: string,
  pulses: Pulse[],
  now: number,
  decayMinutes: number = PULSE_DECAY_MINUTES,
): Pulse[] {
  const cutoff = now - decayMinutes * 60 * 1000
  return pulses.filter(
    (p) => p.venueId === venueId && new Date(p.createdAt).getTime() >= cutoff,
  )
}

function energyBreakdown(pulses: Pulse[]): Partial<Record<EnergyRating, number>> {
  const counts: Partial<Record<EnergyRating, number>> = {}
  for (const p of pulses) {
    counts[p.energyRating] = (counts[p.energyRating] ?? 0) + 1
  }
  return counts
}

function dominantEnergy(breakdown: Partial<Record<EnergyRating, number>>): EnergyRating | null {
  let best: EnergyRating | null = null
  let bestCount = 0
  for (const rating of ['electric', 'buzzing', 'chill', 'dead'] as EnergyRating[]) {
    const n = breakdown[rating] ?? 0
    if (n > bestCount) {
      best = rating
      bestCount = n
    }
  }
  return best
}

function windowPhrase(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes <= 15) return 'last 15 min'
  if (minutes <= 60) return 'last hour'
  if (minutes <= PULSE_DECAY_MINUTES) return `last ${minutes} min`
  return 'earlier tonight'
}

/**
 * Aggregate recent pulses into review-style social proof for a venue.
 * Reuses venue-signal for freshness/report counts; does not fork confidence math.
 */
export function buildLiveReviewProof(
  venue: Venue,
  pulses: Pulse[],
  now: number = Date.now(),
): LiveReviewProof {
  const signal = computeVenueSignal(venue, pulses, { now: new Date(now) })
  const recent = recentPulses(venue.id, pulses, now, DEFAULT_SIGNAL_MODEL.decayMinutes)
  const breakdown = energyBreakdown(recent)
  const dominant =
    dominantEnergy(breakdown) ??
    (signal.reportCount > 0 ? scoreToEnergyRating(venue.pulseScore) : null)

  const reportCount = signal.reportCount > 0 ? signal.reportCount : recent.length
  const freshnessMinutes = signal.freshnessMinutes

  if (reportCount === 0 || freshnessMinutes === null) {
    return {
      reportCount: 0,
      freshnessMinutes: null,
      dominantEnergy: null,
      energyBreakdown: {},
      proofLine: LIVE_REVIEW_LABELS.empty,
      proofChip: LIVE_REVIEW_LABELS.empty,
      proofSummary: LIVE_REVIEW_LABELS.empty,
      decayWindowMinutes: PULSE_DECAY_MINUTES,
    }
  }

  const energyWord = dominant ? ENERGY_CONFIG[dominant].label.toLowerCase() : 'live'
  const window = windowPhrase(freshnessMinutes)
  const countPhrase =
    reportCount === 1 ? '1 said' : `${reportCount} said`

  const proofLine = window
    ? `${countPhrase} ${energyWord} · ${window}`
    : `${countPhrase} ${energyWord}`

  const proofChip =
    freshnessMinutes <= 90
      ? `${reportCount} review${reportCount === 1 ? '' : 's'} · ${freshnessMinutes}m ago`
      : `${reportCount} review${reportCount === 1 ? '' : 's'} · aging`

  const proofSummary =
    freshnessMinutes <= PULSE_DECAY_MINUTES
      ? `${reportCount} live review${reportCount === 1 ? '' : 's'} in ${PULSE_DECAY_MINUTES}m · last ${freshnessMinutes} min`
      : `${reportCount} live review${reportCount === 1 ? '' : 's'} · aging`

  return {
    reportCount,
    freshnessMinutes,
    dominantEnergy: dominant,
    energyBreakdown: breakdown,
    proofLine,
    proofChip,
    proofSummary,
    decayWindowMinutes: PULSE_DECAY_MINUTES,
  }
}

/** Minutes until a pulse expires; null if already gone or invalid. */
export function getPulseTtlMinutes(
  pulse: Pick<Pulse, 'expiresAt' | 'createdAt'>,
  now: number = Date.now(),
): number | null {
  const expires = new Date(pulse.expiresAt).getTime()
  if (!Number.isFinite(expires)) {
    const created = new Date(pulse.createdAt).getTime()
    if (!Number.isFinite(created)) return null
    const fallbackExpires = created + PULSE_DECAY_MINUTES * 60 * 1000
    const remaining = Math.ceil((fallbackExpires - now) / 60000)
    return remaining > 0 ? remaining : null
  }
  const remaining = Math.ceil((expires - now) / 60000)
  return remaining > 0 ? remaining : null
}

/** Snapchat-style TTL chrome, e.g. "Live · fades in 41m". */
export function formatPulseTtlLabel(
  pulse: Pick<Pulse, 'expiresAt' | 'createdAt'>,
  now: number = Date.now(),
): string {
  const minutes = getPulseTtlMinutes(pulse, now)
  if (minutes === null) return 'Expired'
  if (minutes <= 5) return `Live · fades in ${minutes}m`
  if (minutes <= 30) return `Live · fades in ${minutes}m`
  return `Live · fades in ${minutes}m`
}

/** Latest photo URL from recent venue pulses (Instagram-style hero). */
export function getLatestVenuePulsePhoto(
  venueId: string,
  pulses: Pulse[],
  now: number = Date.now(),
): string | null {
  const recent = recentPulses(venueId, pulses, now)
    .filter((p) => p.photos?.length > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return recent[0]?.photos[0] ?? null
}

/** Sort pulses newest-first for the Live reviews stream. */
export function sortLiveReviews(pulses: Pulse[]): Pulse[] {
  return [...pulses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
