/**
 * Shared I’m-here confirm for the venue check-in and the share-arrival CTA.
 *
 * Same path as VenueRoute: check-in, presence, then the existing
 * `requestImHereGlance` → POST /api/push/notify-im-here. Guests do not write
 * or push. A presence row already inside the 90-minute window skips another
 * glance. Surge mute and quiet hours stay in the notify endpoint.
 */

import { getUserIdOrNull } from '@/lib/auth/require-auth'
import { createCheckIn, type CreateCheckInInput } from '@/lib/data/check-ins'
import { USE_SUPABASE_BACKEND } from '@/lib/data/config'
import { requestImHereGlance } from '@/lib/data/im-here-push'
import { writeImHerePresence } from '@/lib/data/presence'
import { IM_HERE_NOTIFY_WINDOW_MS, imHereGlanceStillOpen } from '@/lib/im-here-notify'
import { supabase } from '@/lib/supabase'

export interface ConfirmImHereInput {
  venueId: string
  venueName: string
  signedIn: boolean
  lat?: number
  lng?: number
}

export type ConfirmImHereReason =
  | 'guest'
  | 'backend_off'
  | 'invalid'
  | 'confirmed'
  | 'rate_limited'

export interface ConfirmImHereResult {
  notified: boolean
  reason: ConfirmImHereReason
}

export interface ConfirmImHereDeps {
  backendEnabled: boolean
  createCheckIn: (input: CreateCheckInInput) => Promise<unknown>
  writePresence: (input: { venueId: string; lat?: number; lng?: number }) => Promise<void>
  requestGlance: (input: { venueId: string; venueName: string }) => Promise<void>
  countRecentPresence: (venueId: string) => Promise<number | null>
}

function finiteCoord(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Open presence rows for the signed-in user at this venue, inside the notify window. */
export async function countRecentImHerePresence(venueId: string): Promise<number | null> {
  try {
    const userId = await getUserIdOrNull()
    if (!userId || !venueId) return null
    const since = new Date(Date.now() - IM_HERE_NOTIFY_WINDOW_MS).toISOString()
    const { count, error } = await supabase
      .from('presence')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('venue_id', venueId)
      .is('left_at', null)
      .gte('checked_in_at', since)
    if (error || typeof count !== 'number') return null
    return count
  } catch {
    return null
  }
}

export function defaultConfirmImHereDeps(): ConfirmImHereDeps {
  return {
    backendEnabled: USE_SUPABASE_BACKEND,
    createCheckIn,
    writePresence: writeImHerePresence,
    requestGlance: requestImHereGlance,
    countRecentPresence: countRecentImHerePresence,
  }
}

export async function confirmImHere(
  input: ConfirmImHereInput,
  deps: ConfirmImHereDeps = defaultConfirmImHereDeps(),
): Promise<ConfirmImHereResult> {
  if (!input.signedIn) {
    return { notified: false, reason: 'guest' }
  }
  if (!deps.backendEnabled) {
    return { notified: false, reason: 'backend_off' }
  }

  const venueId = input.venueId.trim()
  const venueName = input.venueName.trim()
  if (!venueId || !venueName) {
    return { notified: false, reason: 'invalid' }
  }

  const recent = await deps.countRecentPresence(venueId)
  const lat = finiteCoord(input.lat)
  const lng = finiteCoord(input.lng)
  await deps.createCheckIn({
    venueId,
    lat,
    lng,
    source: lat !== undefined && lng !== undefined ? 'geo' : 'manual',
  })

  let wrotePresence = false
  try {
    await deps.writePresence({ venueId, lat, lng })
    wrotePresence = true
  } catch {
    wrotePresence = false
  }

  if (!imHereGlanceStillOpen(recent, wrotePresence)) {
    return { notified: false, reason: 'rate_limited' }
  }

  void Promise.resolve(deps.requestGlance({ venueId, venueName })).catch(() => undefined)
  return { notified: true, reason: 'confirmed' }
}
