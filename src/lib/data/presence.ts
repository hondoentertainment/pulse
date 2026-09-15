/**
 * 90-minute venue presence. Writes require a session; guests only read counts.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { emptyHereNow, type HereNowFriend, type HereNowSummary } from '@/lib/here-now'

export const PRESENCE_WINDOW_MINUTES = 90

export async function writeImHerePresence(input: {
  venueId: string
  lat?: number
  lng?: number
}): Promise<void> {
  const userId = await requireUserId({ action: 'say I’m here' })
  const now = new Date().toISOString()
  const { error } = await supabase.from('presence').insert({
    user_id: userId,
    venue_id: input.venueId,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    checked_in_at: now,
    left_at: null,
    visibility: 'everyone',
  })
  if (error) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}

export async function fetchHereNowCount(venueId: string): Promise<number> {
  const { data, error } = await supabase.rpc('venue_here_now_count', {
    p_venue_id: venueId,
  })
  if (error) return 0
  const n = typeof data === 'number' ? data : Number(data)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

export async function fetchHereNowFriends(venueId: string): Promise<HereNowFriend[]> {
  const { data, error } = await supabase.rpc('venue_here_now_friends', {
    p_venue_id: venueId,
  })
  if (error || !Array.isArray(data)) return []
  return data
    .map((row: { user_id?: string; username?: string | null }) => ({
      userId: row.user_id ?? '',
      username: row.username ?? null,
    }))
    .filter((row: HereNowFriend) => Boolean(row.userId))
}

export async function fetchHereNowSummary(
  venueId: string,
  signedIn: boolean,
): Promise<HereNowSummary> {
  const count = await fetchHereNowCount(venueId)
  if (!signedIn) return { count, friends: [] }
  const friends = await fetchHereNowFriends(venueId)
  return { count, friends }
}

export function hereNowFallback(): HereNowSummary {
  return emptyHereNow()
}
