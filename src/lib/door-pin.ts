/**
 * Door pin — verified owner pins one “from the door” pulse to the top of tonight.
 * Pending claims cannot. Guest → /auth.
 */

import type { Pulse } from './types'
import type { VenueClaim } from './venue-owner'
import { canAccessVenueInbox } from './live-reviews'
import { localDateKey } from './tonight-digest'
import { buildAuthPath } from './auth-return-intent'

export const DOOR_PIN_CTA = 'Pin from the door'
export const DOOR_PIN_LABEL = 'From the door'

export interface VenueDoorPin {
  venueId: string
  pulseId: string
  pinnedBy: string
  pinnedAt: string
}

export function canPinFromTheDoor(input: {
  userId: string | null | undefined
  venueId: string
  claims: VenueClaim[]
}): boolean {
  return canAccessVenueInbox(input)
}

export function pinDoorPulse(input: {
  venueId: string
  pulseId: string
  userId: string
  nowIso?: string
}): VenueDoorPin {
  return {
    venueId: input.venueId,
    pulseId: input.pulseId,
    pinnedBy: input.userId,
    pinnedAt: input.nowIso ?? new Date().toISOString(),
  }
}

export function orderPulsesDoorPinnedFirst<T extends Pick<Pulse, 'id' | 'createdAt'>>(
  pulses: readonly T[],
  pin: VenueDoorPin | null | undefined,
  now: Date = new Date(),
): T[] {
  if (!pin) return [...pulses].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const today = localDateKey(now)
  const pinIsTonight = pulses.some((pulse) => (
    pulse.id === pin.pulseId && localDateKey(new Date(pulse.createdAt)) === today
  ))
  if (!pinIsTonight) {
    return [...pulses].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }
  const pinned = pulses.filter((pulse) => pulse.id === pin.pulseId)
  const rest = pulses
    .filter((pulse) => pulse.id !== pin.pulseId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return [...pinned, ...rest]
}

export function doorPinAuthPath(venueId: string): string {
  return buildAuthPath(`/venue/${encodeURIComponent(venueId)}`)
}
