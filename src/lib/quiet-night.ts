/**
 * Quiet-night coach ~9pm: if Surging is empty, nudge people who follow
 * a neighborhood/venue to “be the first at {venue}”. Honest, no fake crowds.
 */

import type { Pulse, Venue } from './types'
import { listEmptySurgingStartHere } from './empty-surging'
import { isDensityNeighborhood } from './seattle-density'
import { localDateKey, localHour } from './tonight-digest'

export const QUIET_NIGHT_HOUR = 21
export const QUIET_NIGHT_STORAGE_KEY = 'pulse_quiet_night_v1'

export interface QuietNightNote {
  title: string
  body: string
  venueId: string
  venueName: string
  localDateKey: string
}

export function isSurgingEmpty(
  pulses: readonly Pulse[],
  nowMs: number = Date.now(),
  windowMs = 60 * 60 * 1000,
): boolean {
  return !pulses.some((pulse) => {
    const created = Date.parse(pulse.createdAt)
    return Number.isFinite(created) && nowMs - created <= windowMs && created <= nowMs
  })
}

export function pickQuietNightVenue(
  venues: readonly Venue[],
  followedVenueIds: readonly string[] = [],
): Venue | null {
  const followed = venues.filter((venue) => followedVenueIds.includes(venue.id))
  const pool = followed.length > 0 ? followed : listEmptySurgingStartHere(venues, 3)
  if (pool.length === 0) return null
  const density = pool.find((venue) => isDensityNeighborhood(venue.neighborhood))
  return density ?? pool[0] ?? null
}

export function buildQuietNightNote(input: {
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  followedVenueIds?: readonly string[]
  now?: Date
}): QuietNightNote | null {
  const now = input.now ?? new Date()
  if (!isSurgingEmpty(input.pulses, now.getTime())) return null
  const venue = pickQuietNightVenue(input.venues, input.followedVenueIds ?? [])
  if (!venue) return null
  return {
    title: 'Quiet night',
    body: `Be the first at ${venue.name}`,
    venueId: venue.id,
    venueName: venue.name,
    localDateKey: localDateKey(now),
  }
}

export function isQuietNightHour(now: Date = new Date(), timeZone?: string): boolean {
  return localHour(now, timeZone) === QUIET_NIGHT_HOUR
}

export function shouldShowQuietNight(input: {
  now?: Date
  lastShownDateKey?: string | null
  surgingEmpty: boolean
}): boolean {
  const now = input.now ?? new Date()
  if (!isQuietNightHour(now)) return false
  if (!input.surgingEmpty) return false
  return input.lastShownDateKey !== localDateKey(now)
}
