/**
 * Trust-at-a-glance row for map pins and venue cards.
 * Freshness · GPS/unverified · why the room is surging.
 */

import type { Pulse, Venue } from './types'
function formatFreshness(dateString: string, nowMs: number): string {
  const then = new Date(dateString).getTime()
  const diffMins = Math.floor((nowMs - then) / 60000)
  if (!Number.isFinite(diffMins) || diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}
import {
  getVenueMapActivity,
  type VenueMapActivity,
} from './map-live-reviews'
import { isLiveReview } from './live-reviews'

export const SURGE_WHY_WINDOW_MINUTES = 20
export const SURGE_WHY_MIN_REVIEWS = 3

export interface TrustChip {
  id: 'freshness' | 'verified' | 'density'
  label: string
  tone: 'hot' | 'ok' | 'soft'
}

export interface TrustGlance {
  freshness: string
  verification: 'GPS ✓' | 'Unverified'
  whySurging: string
  line: string
  liveReviewCount: number
  locationVerified: boolean
  chips: TrustChip[]
}

export function countReviewsInWindow(
  pulses: Pulse[],
  venueId: string,
  windowMinutes: number,
  nowMs: number = Date.now(),
): number {
  const cutoff = nowMs - windowMinutes * 60 * 1000
  let count = 0
  for (const pulse of pulses) {
    if (pulse.venueId !== venueId || !isLiveReview(pulse)) continue
    const created = new Date(pulse.createdAt).getTime()
    if (Number.isFinite(created) && created >= cutoff && created <= nowMs) count += 1
  }
  return count
}

export function formatWhySurging(
  recentCount: number,
  windowMinutes: number = SURGE_WHY_WINDOW_MINUTES,
): string {
  if (recentCount >= SURGE_WHY_MIN_REVIEWS) {
    return `Why surging: +${recentCount} reviews / ${windowMinutes}m`
  }
  return 'Soft signal'
}

export function buildTrustGlance(
  venue: Venue,
  pulses: Pulse[],
  nowMs: number = Date.now(),
  activity?: VenueMapActivity,
): TrustGlance {
  const resolved = activity ?? getVenueMapActivity(venue, pulses, nowMs)
  const latest = resolved.latest
  const freshness = latest
    ? formatFreshness(latest.createdAt, nowMs)
    : venue.lastPulseAt
      ? formatFreshness(venue.lastPulseAt, nowMs)
      : 'No pulses yet'
  const locationVerified = latest?.locationVerified === true
  const verification: TrustGlance['verification'] = locationVerified ? 'GPS ✓' : 'Unverified'
  const recentCount = countReviewsInWindow(pulses, venue.id, SURGE_WHY_WINDOW_MINUTES, nowMs)
  const whySurging = formatWhySurging(recentCount)
  const chips = buildTrustChips({
    freshness,
    verification,
    whySurging,
    recentCount,
    locationVerified,
  })
  return {
    freshness,
    verification,
    whySurging,
    line: `${freshness} · ${verification} · ${whySurging}`,
    liveReviewCount: resolved.liveReviewCount,
    locationVerified,
    chips,
  }
}

export function buildTrustChips(input: {
  freshness: string
  verification: TrustGlance['verification']
  whySurging: string
  recentCount: number
  locationVerified: boolean
}): TrustChip[] {
  const densityLabel = input.recentCount >= SURGE_WHY_MIN_REVIEWS
    ? `+${input.recentCount} / ${SURGE_WHY_WINDOW_MINUTES}m`
    : 'Soft signal'
  return [
    {
      id: 'freshness',
      label: input.freshness,
      tone: input.freshness === 'No pulses yet' ? 'soft' : 'ok',
    },
    {
      id: 'verified',
      label: input.locationVerified ? 'Verified' : 'Unverified',
      tone: input.locationVerified ? 'hot' : 'soft',
    },
    {
      id: 'density',
      label: densityLabel,
      tone: input.recentCount >= SURGE_WHY_MIN_REVIEWS ? 'hot' : 'soft',
    },
  ]
}
