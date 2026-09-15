/**
 * Last night — signed-in recap of rooms the user pulsed, pinned, or was here.
 * Guest → /auth. Honest empty if none.
 */

import type { Pulse, Venue } from './types'
import { localDateKey } from './tonight-digest'
import { buildAuthPath } from './auth-return-intent'

export const LAST_NIGHT_TZ = 'America/Los_Angeles'
export const LAST_NIGHT_CTA = 'Last night'
export const LAST_NIGHT_EMPTY = 'No rooms last night.'
export const LAST_NIGHT_EMPTY_BODY =
  'Pulse, pin My night, or tap I’m here — we’ll recap those rooms. We never invent a list.'

export interface LastNightPresence {
  venueId: string
  userId: string
  checkedInAt: string
  leftAt?: string | null
}

export interface LastNightRoom {
  venue: Venue
  reasons: Array<'pulsed' | 'pinned' | 'here'>
}

export function lastNightDateKey(now: Date = new Date(), timeZone = LAST_NIGHT_TZ): string {
  const today = localDateKey(now, timeZone)
  const [year, month, day] = today.split('-').map(Number)
  const utcNoon = Date.UTC(year, month - 1, day, 20, 0, 0)
  const yesterday = new Date(utcNoon - 24 * 60 * 60 * 1000)
  return localDateKey(yesterday, timeZone)
}

function isOnLastNight(iso: string, lastNightKey: string, timeZone = LAST_NIGHT_TZ): boolean {
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return false
  return localDateKey(at, timeZone) === lastNightKey
}

export function listLastNightRooms(input: {
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  userId: string
  pinnedVenueIds?: readonly string[]
  presence?: readonly LastNightPresence[]
  now?: Date
}): LastNightRoom[] {
  const lastNightKey = lastNightDateKey(input.now)
  const venueById = new Map(input.venues.map((venue) => [venue.id, venue]))
  const reasons = new Map<string, Set<LastNightRoom['reasons'][number]>>()

  const add = (venueId: string, reason: LastNightRoom['reasons'][number]) => {
    if (!venueById.has(venueId)) return
    const set = reasons.get(venueId) ?? new Set()
    set.add(reason)
    reasons.set(venueId, set)
  }

  for (const pulse of input.pulses) {
    if (pulse.userId !== input.userId) continue
    if (!isOnLastNight(pulse.createdAt, lastNightKey)) continue
    add(pulse.venueId, 'pulsed')
  }

  for (const venueId of input.pinnedVenueIds ?? []) {
    add(venueId, 'pinned')
  }

  for (const row of input.presence ?? []) {
    if (row.userId !== input.userId) continue
    if (!isOnLastNight(row.checkedInAt, lastNightKey)) continue
    add(row.venueId, 'here')
  }

  return [...reasons.entries()]
    .map(([venueId, set]) => ({
      venue: venueById.get(venueId)!,
      reasons: (['pulsed', 'pinned', 'here'] as const).filter((reason) => set.has(reason)),
    }))
    .sort((a, b) => a.venue.name.localeCompare(b.venue.name))
}

export function lastNightAuthPath(): string {
  return buildAuthPath('/?last=1')
}
