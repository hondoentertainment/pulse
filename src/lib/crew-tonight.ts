/**
 * Crew tonight — signed-in pick of 2–4 followed people onto a My-night pin.
 * Reuses friends + invite link. No SMS vendor. Guest → /auth.
 */

import { getVenueInviteShareUrl, INVITE_FRIEND_COPY } from './invite-friend'
import { buildAuthPath } from './auth-return-intent'

export const CREW_TONIGHT_MIN = 2
export const CREW_TONIGHT_MAX = 4
export const CREW_TONIGHT_CTA = 'Crew tonight'
export const CREW_TONIGHT_GUEST = 'Sign in to pick a crew'

export interface CrewTonightPick {
  ownerId: string
  venueId: string
  memberUserIds: string[]
}

export function sanitizeCrewMemberIds(
  followedUserIds: readonly string[],
  picked: readonly string[],
  ownerId?: string,
): string[] {
  const followed = new Set(followedUserIds)
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of picked) {
    if (!id || id === ownerId) continue
    if (!followed.has(id) || seen.has(id)) continue
    seen.add(id)
    next.push(id)
    if (next.length >= CREW_TONIGHT_MAX) break
  }
  return next
}

export function canSaveCrewTonight(memberUserIds: readonly string[]): boolean {
  return memberUserIds.length >= CREW_TONIGHT_MIN && memberUserIds.length <= CREW_TONIGHT_MAX
}

export function toggleCrewMember(
  current: readonly string[],
  userId: string,
  followedUserIds: readonly string[],
  ownerId?: string,
): string[] {
  if (userId === ownerId || !followedUserIds.includes(userId)) {
    return sanitizeCrewMemberIds(followedUserIds, current, ownerId)
  }
  if (current.includes(userId)) {
    return current.filter((id) => id !== userId)
  }
  if (current.length >= CREW_TONIGHT_MAX) return [...current]
  return [...current, userId]
}

export function crewTonightInviteUrl(venueId: string, baseUrl?: string): string {
  return getVenueInviteShareUrl(venueId, baseUrl)
}

export function crewTonightAuthPath(venueId: string): string {
  return buildAuthPath(`/venue/${encodeURIComponent(venueId)}?crew=1`)
}

export const CREW_TONIGHT_COPY = {
  cta: CREW_TONIGHT_CTA,
  guest: CREW_TONIGHT_GUEST,
  share: INVITE_FRIEND_COPY.shareText,
  needPin: 'Pin this room to My night first',
  needPeople: 'Pick 2–4 people you already follow',
} as const
