/**
 * Persist venue follows in `venue_follows` (user_id + venue_id).
 * RLS: the signed-in user reads and writes only their own rows.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { VENUE_FOLLOW_LIMIT } from '@/lib/venue-follows'

export interface VenueFollowRow {
  user_id: string
  venue_id: string
  created_at: string
}

export async function listMyVenueFollows(userId: string): Promise<string[]> {
  if (!userId) return []
  const { data, error } = await supabase
    .from('venue_follows')
    .select('venue_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data
    .map((row) => (typeof row.venue_id === 'string' ? row.venue_id : ''))
    .filter(Boolean)
}

export async function followVenue(venueId: string): Promise<void> {
  const userId = await requireUserId({ action: 'follow this venue' })
  const existing = await listMyVenueFollows(userId)
  if (existing.includes(venueId)) return
  if (existing.length >= VENUE_FOLLOW_LIMIT) {
    throw new Error('Maximum 10 followed venues')
  }
  const { error } = await supabase.from('venue_follows').upsert(
    { user_id: userId, venue_id: venueId },
    { onConflict: 'user_id,venue_id' },
  )
  if (error) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}

export async function unfollowVenue(venueId: string): Promise<void> {
  const userId = await requireUserId({ action: 'unfollow this venue' })
  const { error } = await supabase
    .from('venue_follows')
    .delete()
    .eq('user_id', userId)
    .eq('venue_id', venueId)
  if (error) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}

export async function setVenueFollow(venueId: string, follow: boolean): Promise<void> {
  if (follow) await followVenue(venueId)
  else await unfollowVenue(venueId)
}
