/**
 * Venue follows persist in the existing `follows` table
 * (target_kind = 'venue', target_venue_id). Soft-delete via deleted_at.
 * Do not use a second venue_follows table.
 */

import { requireUserId } from '@/lib/auth/require-auth'
import { VENUE_FOLLOW_LIMIT } from '@/lib/venue-follows'
import {
  followVenue as persistFollowVenue,
  listFollowedVenues,
  unfollowVenue as persistUnfollowVenue,
} from './follows'

export async function listMyVenueFollows(userId: string): Promise<string[]> {
  if (!userId) return []
  return listFollowedVenues(userId)
}

export async function followVenue(venueId: string): Promise<void> {
  const userId = await requireUserId({ action: 'follow this venue' })
  const existing = await listFollowedVenues(userId)
  if (existing.includes(venueId)) return
  if (existing.length >= VENUE_FOLLOW_LIMIT) {
    throw new Error('Maximum 10 followed venues')
  }
  await persistFollowVenue(venueId)
}

export async function unfollowVenue(venueId: string): Promise<void> {
  await persistUnfollowVenue(venueId)
}

export async function setVenueFollow(venueId: string, follow: boolean): Promise<void> {
  if (follow) await followVenue(venueId)
  else await unfollowVenue(venueId)
}
