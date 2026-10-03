/**
 * Invite a friend — share link that opens the venue with I’m-here primed.
 * Reuses /api/share/venue + OG. No invite vendor.
 */

import { getVenueSharePreviewUrl } from './sharing'

export const INVITE_FROM = 'invite'

export function getVenueInviteLandingPath(venueId: string): string {
  return `/venue/${encodeURIComponent(venueId)}?from=${INVITE_FROM}`
}

export function getVenueInviteMapPath(venueId: string): string {
  return `/?here=${encodeURIComponent(venueId)}`
}

export function isInviteArrival(search: string | { get(name: string): string | null }): boolean {
  const value = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('from')
    : search.get('from')
  return value === INVITE_FROM
}

export function getVenueInviteShareUrl(
  venueId: string,
  baseUrl?: string,
): string {
  return `${getVenueSharePreviewUrl(venueId, baseUrl)}&from=${INVITE_FROM}`
}

export const INVITE_FRIEND_COPY = {
  cta: 'Invite a friend',
  shareTitle: 'Meet me here on Pulse',
  shareText: 'I’m heading here — open the pin and tap I’m here.',
} as const
