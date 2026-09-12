/**
 * Venue follow rules + RLS intent.
 *
 * Persistence lives in `venue_follows` (user_id + venue_id). Guests never
 * write — Follow sends them to /auth. Soft cap of 10 matches existing copy.
 */

export const VENUE_FOLLOW_LIMIT = 10

export const VENUE_FOLLOWS_RLS = {
  table: 'venue_follows',
  select: 'auth.uid() = user_id',
  insert: 'auth.uid() = user_id',
  delete: 'auth.uid() = user_id',
  anon: 'none',
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
