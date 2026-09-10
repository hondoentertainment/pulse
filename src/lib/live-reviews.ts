/**
 * Live Reviews — on-site venue pulses with energy + required caption.
 *
 * A LiveReview is stored on the existing `pulses` row (`kind: 'review'`),
 * not a parallel table. Reviews inherit venue geo/launch gates because they
 * can only be created against venues already in the visible catalog.
 */

import { CHECK_IN_RADIUS_MILES, COOLDOWN_MINUTES, ENERGY_CONFIG, type EnergyRating, type Pulse, type PulseKind, type Venue } from './types'
import { canPostPulse, calculateDistance, formatTimeAgo, isWithinRadius } from './pulse-engine'
import type { VenueClaim } from './venue-owner'

export const LIVE_REVIEW_CAPTION_MIN = 1
export const LIVE_REVIEW_CAPTION_MAX = 280
export const LIVE_NOW_WINDOW_MINUTES = 90
export const LIVE_HOUR_WINDOW_MINUTES = 60
export const LIVE_REVIEWS_LAST_HOUR_MINUTES = LIVE_HOUR_WINDOW_MINUTES
export const LIVE_REVIEW_COOLDOWN_MINUTES = COOLDOWN_MINUTES

export interface LocationProof {
  locationVerified: boolean
  distanceMi?: number
  reason: 'verified' | 'outside_radius' | 'location_unavailable'
}

export interface LiveReviewValidation {
  ok: boolean
  error?: string
  caption: string
}

export function parsePulseKind(value: unknown): PulseKind | undefined {
  if (value === 'review' || value === 'pulse') return value
  return undefined
}

export function pulseHasBody(caption?: string | null): boolean {
  return Boolean(caption && caption.trim().length > 0)
}

export function mapLiveReviewFields(row: {
  kind?: unknown
  location_verified?: unknown
  caption?: unknown
}): Pick<Pulse, 'kind' | 'locationVerified' | 'hasBody'> {
  const caption = typeof row.caption === 'string' ? row.caption : undefined
  return {
    kind: parsePulseKind(row.kind),
    locationVerified: typeof row.location_verified === 'boolean' ? row.location_verified : undefined,
    hasBody: pulseHasBody(caption),
  }
}

/**
 * Explicit `kind: 'review'` is a live review.
 * Legacy/unspecified rows with a caption are treated as reviews so mock and
 * pre-migration pulses still appear in Live now. Energy-only `kind: 'pulse'`
 * stays a check-in.
 */
export function isLiveReview(pulse: Pick<Pulse, 'kind' | 'caption' | 'hasBody'>): boolean {
  if (pulse.kind === 'review') return true
  if (pulse.kind === 'pulse') return false
  return pulse.hasBody === true || pulseHasBody(pulse.caption)
}

export function validateLiveReviewCaption(raw: string | undefined | null): LiveReviewValidation {
  const caption = (raw ?? '').trim()
  if (caption.length < LIVE_REVIEW_CAPTION_MIN) {
    return { ok: false, error: 'Caption is required for a live review', caption }
  }
  if (caption.length > LIVE_REVIEW_CAPTION_MAX) {
    return { ok: false, error: `Caption must be ${LIVE_REVIEW_CAPTION_MAX} characters or fewer`, caption }
  }
  return { ok: true, caption }
}

export function evaluateLocationProof(
  userLocation: { lat: number; lng: number } | null | undefined,
  venueLocation: { lat: number; lng: number } | null | undefined,
  radiusMiles: number = CHECK_IN_RADIUS_MILES,
): LocationProof {
  if (!userLocation || !venueLocation) {
    return { locationVerified: false, reason: 'location_unavailable' }
  }
  const distanceMi = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    venueLocation.lat,
    venueLocation.lng,
  )
  if (isWithinRadius(userLocation.lat, userLocation.lng, venueLocation.lat, venueLocation.lng, radiusMiles)) {
    return { locationVerified: true, distanceMi, reason: 'verified' }
  }
  return { locationVerified: false, distanceMi, reason: 'outside_radius' }
}

export function canPostLiveReview(
  venueId: string,
  userPulses: Pulse[],
  cooldownMinutes: number = LIVE_REVIEW_COOLDOWN_MINUTES,
): { canPost: boolean; remainingMinutes?: number } {
  return canPostPulse(venueId, userPulses, cooldownMinutes)
}

export function isWithinLiveNowWindow(
  createdAt: string,
  nowMs: number = Date.now(),
  windowMinutes: number = LIVE_NOW_WINDOW_MINUTES,
): boolean {
  const createdMs = new Date(createdAt).getTime()
  if (Number.isNaN(createdMs)) return false
  return nowMs - createdMs <= windowMinutes * 60 * 1000 && nowMs - createdMs >= 0
}

export function getLiveNowReviews<T extends Pulse>(
  pulses: T[],
  venueId?: string,
  nowMs: number = Date.now(),
  windowMinutes: number = LIVE_NOW_WINDOW_MINUTES,
): T[] {
  return pulses
    .filter((pulse) => (venueId ? pulse.venueId === venueId : true))
    .filter((pulse) => isLiveReview(pulse) && isWithinLiveNowWindow(pulse.createdAt, nowMs, windowMinutes))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function countLiveReviewsInWindow(
  pulses: Pulse[],
  venueId: string,
  windowMinutes: number = LIVE_NOW_WINDOW_MINUTES,
  nowMs: number = Date.now(),
): number {
  return getLiveNowReviews(pulses, venueId, nowMs, windowMinutes).length
}

export function snippetCaption(caption: string | undefined, max = 80): string {
  const text = (caption ?? '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** Figma map / Surging copy: "8 live reviews · last hour". Empty when none. */
export function formatLiveReviewsLastHour(count: number): string {
  if (count <= 0) return ''
  return `${count} live review${count === 1 ? '' : 's'} · last hour`
}

export function relativeReviewTime(createdAt: string): string {
  return formatTimeAgo(createdAt).replace(/\s+ago$/, '')
}

/** 0–100 score from energy pills (Dead 0 · Electric 100). */
export function averageEnergyScore(pulses: Array<{ energyRating: EnergyRating }>): number {
  if (pulses.length === 0) return 0
  const sum = pulses.reduce((acc, pulse) => acc + ENERGY_CONFIG[pulse.energyRating].value, 0)
  return Math.round((sum / pulses.length) * (100 / 3))
}

export function venueStatusLine(venue: Pick<Venue, 'neighborhood' | 'city' | 'hours'>): string {
  const place = venue.neighborhood || venue.city
  const hours = venue.hours
  let status = ''
  if (hours) {
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const today = hours[day as keyof typeof hours]
    if (today && today !== 'Closed') status = 'Open now'
    else if (today === 'Closed') status = 'Closed'
  }
  return [place, status].filter(Boolean).join(' · ')
}

export function energyScoreColor(score: number): string {
  if (score >= 75) return ENERGY_CONFIG.electric.color
  if (score >= 50) return ENERGY_CONFIG.buzzing.color
  return ENERGY_CONFIG.chill.color
}

/** Tonight starts at 16:00 local. If it is before 16:00, use yesterday 16:00. */
export function tonightWindowStart(now: Date = new Date()): Date {
  const start = new Date(now)
  start.setHours(16, 0, 0, 0)
  if (now.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1)
  }
  return start
}

export function getTonightLiveReviews<T extends Pulse>(
  pulses: T[],
  venueId: string,
  now: Date = new Date(),
): T[] {
  const startMs = tonightWindowStart(now).getTime()
  return pulses
    .filter((pulse) => pulse.venueId === venueId)
    .filter((pulse) => isLiveReview(pulse))
    .filter((pulse) => new Date(pulse.createdAt).getTime() >= startMs)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function canAccessVenueInbox(params: {
  userId: string | null | undefined
  venueId: string
  claims?: VenueClaim[]
  staffRoles?: Array<{ venueId: string; userId: string }>
}): boolean {
  const { userId, venueId, claims = [], staffRoles = [] } = params
  if (!userId) return false
  if (claims.some((claim) => claim.venueId === venueId && claim.claimantUserId === userId && claim.status === 'verified')) {
    return true
  }
  return staffRoles.some((role) => role.venueId === venueId && role.userId === userId)
}

export function energyChipLabel(energy: EnergyRating): string {
  switch (energy) {
    case 'dead':
      return 'Dead'
    case 'chill':
      return 'Chill'
    case 'buzzing':
      return 'Buzzing'
    case 'electric':
      return 'Electric'
  }
}
