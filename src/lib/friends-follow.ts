/**
 * Friends — follow people via follows.target_kind / target_user_id.
 * Tonight Following can mix followed people’s pulses with followed venues.
 */

import type { Pulse, Venue } from './types'
import type { TonightFollowingRow } from './tonight-home'

export const FRIEND_FOLLOW_COPY = {
  follow: 'Follow',
  following: 'Following',
  guest: 'Sign in to follow people',
} as const

export interface FriendPulseRow {
  kind: 'friend_pulse'
  pulse: Pulse
  venue: Venue | null
}

export type FollowingMixRow =
  | ({ kind: 'venue' } & TonightFollowingRow)
  | FriendPulseRow

export function listFollowedPeoplePulses(
  pulses: readonly Pulse[],
  venues: readonly Venue[],
  followedUserIds: readonly string[],
): FriendPulseRow[] {
  const people = new Set(followedUserIds)
  if (people.size === 0) return []
  const venueById = new Map(venues.map((venue) => [venue.id, venue]))
  return [...pulses]
    .filter((pulse) => people.has(pulse.userId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((pulse) => ({
      kind: 'friend_pulse' as const,
      pulse,
      venue: venueById.get(pulse.venueId) ?? null,
    }))
}

export function mixFollowingFeed(
  venueRows: readonly TonightFollowingRow[],
  friendRows: readonly FriendPulseRow[],
): FollowingMixRow[] {
  const venues: FollowingMixRow[] = venueRows.map((row) => ({ kind: 'venue', ...row }))
  return [...venues, ...friendRows].sort((a, b) => {
    const aTime = a.kind === 'venue'
      ? (a.latestPulse ? Date.parse(a.latestPulse.createdAt) : 0)
      : Date.parse(a.pulse.createdAt)
    const bTime = b.kind === 'venue'
      ? (b.latestPulse ? Date.parse(b.latestPulse.createdAt) : 0)
      : Date.parse(b.pulse.createdAt)
    return bTime - aTime
  })
}
