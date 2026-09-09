/**
 * Map-facing live-review activity.
 *
 * Heat, Surging rank, and toast payloads are derived from real `pulses`
 * (`kind=review` / captioned legacy rows). Quiet venues stay quiet.
 */

import type { EnergyRating, Pulse, Venue } from './types'
import {
  formatLiveReviewsLastHour,
  getLiveNowReviews,
  isLiveReview,
  LIVE_HOUR_WINDOW_MINUTES,
  snippetCaption,
} from './live-reviews'
import { calculateDistance } from './pulse-engine'

export const MAP_SURGE_RADIUS_MI = 50
export const MAP_FRESH_REVIEW_MINUTES = 10

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface VenueMapActivity {
  liveReviewCount: number
  latest: Pulse | null
  heatScore: number
  radiusFactor: number
  heatColor: RgbColor
  hasFreshReview: boolean
  countLabel: string
}

export interface MapLiveToast {
  id: string
  venueId: string
  venueName: string
  snippet: string
  energy: EnergyRating
  createdAt: string
}

const ENERGY_HEAT: Record<EnergyRating, number> = {
  dead: 0,
  chill: 3,
  buzzing: 6,
  electric: 10,
}

const ENERGY_RGB: Record<EnergyRating, RgbColor> = {
  dead: { r: 138, g: 138, b: 147 },
  chill: { r: 0, g: 209, b: 255 },
  buzzing: { r: 255, g: 138, b: 0 },
  electric: { r: 255, g: 45, b: 120 },
}

export function heatColorForScore(score: number): RgbColor {
  if (score >= 80) return ENERGY_RGB.electric
  if (score >= 60) return ENERGY_RGB.buzzing
  if (score >= 30) return ENERGY_RGB.chill
  return ENERGY_RGB.dead
}

export function getVenueMapActivity(
  venue: Venue,
  pulses: Pulse[],
  nowMs: number = Date.now(),
): VenueMapActivity {
  const live = getLiveNowReviews(pulses, venue.id, nowMs, LIVE_HOUR_WINDOW_MINUTES)
  const latest = live[0] ?? null
  const liveReviewCount = live.length
  const volumeBoost = liveReviewCount > 0 ? Math.min(28, liveReviewCount * 7) : 0
  const energyBoost = latest ? ENERGY_HEAT[latest.energyRating] : 0
  const heatScore = Math.min(100, Math.max(0, venue.pulseScore + volumeBoost + energyBoost))
  const latestMs = latest ? new Date(latest.createdAt).getTime() : NaN
  const hasFreshReview = Number.isFinite(latestMs)
    && nowMs - latestMs <= MAP_FRESH_REVIEW_MINUTES * 60 * 1000
    && nowMs - latestMs >= 0

  return {
    liveReviewCount,
    latest,
    heatScore,
    radiusFactor: 1 + Math.min(0.85, liveReviewCount * 0.14),
    heatColor: latest ? ENERGY_RGB[latest.energyRating] : heatColorForScore(heatScore),
    hasFreshReview,
    countLabel: formatLiveReviewsLastHour(liveReviewCount),
  }
}

export function compareVenueMapActivity(a: VenueMapActivity, b: VenueMapActivity): number {
  if (b.liveReviewCount !== a.liveReviewCount) return b.liveReviewCount - a.liveReviewCount
  if (b.heatScore !== a.heatScore) return b.heatScore - a.heatScore
  return 0
}

export function getSurgingNearbyVenues(
  venues: Venue[],
  pulses: Pulse[],
  options: {
    userLocation?: { lat: number; lng: number } | null
    maxDistanceMi?: number
    limit?: number
    nowMs?: number
  } = {},
): Venue[] {
  const {
    userLocation = null,
    maxDistanceMi = MAP_SURGE_RADIUS_MI,
    limit = 6,
    nowMs = Date.now(),
  } = options

  return venues
    .filter((venue) => {
      if (userLocation) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng,
        )
        if (distance > maxDistanceMi) return false
      }
      return getVenueMapActivity(venue, pulses, nowMs).liveReviewCount > 0
    })
    .sort((a, b) => compareVenueMapActivity(
      getVenueMapActivity(a, pulses, nowMs),
      getVenueMapActivity(b, pulses, nowMs),
    ))
    .slice(0, limit)
}

export function stampVenuesFromLiveReviews(venues: Venue[], reviews: Pulse[]): Venue[] {
  const latestByVenue = new Map<string, Pulse>()
  for (const pulse of reviews) {
    if (!isLiveReview(pulse)) continue
    const current = latestByVenue.get(pulse.venueId)
    if (!current || new Date(pulse.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      latestByVenue.set(pulse.venueId, pulse)
    }
  }
  if (latestByVenue.size === 0) return venues

  return venues.map((venue) => {
    const latest = latestByVenue.get(venue.id)
    if (!latest) return venue
    return {
      ...venue,
      lastActivity: latest.createdAt,
      lastPulseAt: latest.createdAt,
    }
  })
}

export function buildMapLiveToast(pulse: Pulse, venue: Venue): MapLiveToast {
  return {
    id: pulse.id,
    venueId: venue.id,
    venueName: venue.name,
    snippet: snippetCaption(pulse.caption, 72),
    energy: pulse.energyRating,
    createdAt: pulse.createdAt,
  }
}

/**
 * After the first snapshot, only reviews that were not already seen
 * (and that belong to a visible venue) are treated as arrivals.
 */
export function collectLiveReviewArrivals(
  seenIds: ReadonlySet<string>,
  primed: boolean,
  pulses: Pulse[],
  venues: Venue[],
  nowMs: number = Date.now(),
): { nextSeen: Set<string>; nextPrimed: boolean; arrivals: MapLiveToast[] } {
  const live = getLiveNowReviews(pulses, undefined, nowMs, LIVE_HOUR_WINDOW_MINUTES)
  const nextSeen = new Set(seenIds)
  if (!primed) {
    for (const pulse of live) nextSeen.add(pulse.id)
    return { nextSeen, nextPrimed: true, arrivals: [] }
  }

  const venueById = new Map(venues.map((venue) => [venue.id, venue]))
  const arrivals: MapLiveToast[] = []
  for (const pulse of live) {
    if (nextSeen.has(pulse.id)) continue
    nextSeen.add(pulse.id)
    const venue = venueById.get(pulse.venueId)
    if (!venue) continue
    arrivals.push(buildMapLiveToast(pulse, venue))
  }
  return { nextSeen, nextPrimed: true, arrivals }
}
