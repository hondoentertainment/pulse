/**
 * Venue follow rules + RLS intent.
 *
 * Persistence lives in existing `follows`:
 *   target_kind = 'venue', target_venue_id, soft-delete via deleted_at.
 * Prod RLS (unchanged): public SELECT of live rows; writes are follower-owned.
 * Guests never write — Follow sends them to /auth.
 */

export const VENUE_FOLLOW_LIMIT = 10

export const VENUE_FOLLOWS_RLS = {
  table: 'follows',
  select: 'deleted_at IS NULL OR is_admin()',
  insert: 'auth.uid() = follower_id',
  update: 'auth.uid() = follower_id OR is_admin()',
  delete: 'auth.uid() = follower_id OR is_admin()',
  venueRow: 'target_kind = venue AND target_venue_id IS NOT NULL',
  anon: 'no writes',
} as const

export const VENUE_FOLLOW_COPY = {
  follow: 'Follow',
  following: 'Following',
  guestTitle: 'Sign in to follow',
  guestDescription: 'Follow a venue to see its latest live pulses tonight.',
  limitTitle: 'Maximum 10 followed venues',
  limitDescription: 'Unfollow one to add another',
  followed: 'Following venue',
  unfollowed: 'Unfollowed venue',
} as const

export function canFollowAnotherVenue(
  followedVenueIds: readonly string[],
  venueId: string,
  limit = VENUE_FOLLOW_LIMIT,
): boolean {
  if (followedVenueIds.includes(venueId)) return true
  return followedVenueIds.length < limit
}

export function nextFollowedVenueIds(
  followedVenueIds: readonly string[],
  venueId: string,
): { ids: string[]; didFollow: boolean } | { error: 'limit' } {
  if (followedVenueIds.includes(venueId)) {
    return { ids: followedVenueIds.filter((id) => id !== venueId), didFollow: false }
  }
  if (followedVenueIds.length >= VENUE_FOLLOW_LIMIT) {
    return { error: 'limit' }
  }
  return { ids: [...followedVenueIds, venueId], didFollow: true }
}
