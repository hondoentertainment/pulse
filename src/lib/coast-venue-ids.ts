/**
 * Durable ids for the Portland and San Francisco curated seeds.
 *
 * `venues.id` and `pulses.venue_id` are UUIDs. The client slug
 * (`pdx-crystal-ballroom`, `sf-chapel`) stays on `catalogSlug` so a share
 * URL still opens the same room. The UUID is what the catalog ships and
 * what the seed migration inserts.
 */

import { localLaunchVenueIdForShareId } from './seattle-launch-venues.js'

export const PORTLAND_LAUNCH_UUID_PREFIX = 'd0000000-0000-4000-8000-'
export const SAN_FRANCISCO_LAUNCH_UUID_PREFIX = 'e0000000-0000-4000-8000-'

export function indexedLaunchUuid(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(12, '0')}`
}

export function coastCityKeyForLaunchShareId(id: string): 'portland' | 'san-francisco' | null {
  if (id.startsWith('pdx-') || id.startsWith(PORTLAND_LAUNCH_UUID_PREFIX)) return 'portland'
  if (id.startsWith('sf-') || id.startsWith(SAN_FRANCISCO_LAUNCH_UUID_PREFIX)) return 'san-francisco'
  return null
}

export function launchVenueMatchesShareId(
  venue: { id: string; catalogSlug?: string },
  shareId: string,
): boolean {
  const raw = shareId.trim()
  if (!raw) return false
  if (venue.id === raw || venue.catalogSlug === raw) return true
  const seattleLocal = localLaunchVenueIdForShareId(raw)
  return seattleLocal != null && venue.id === seattleLocal
}

export function findWritableVenue<T extends { id: string; catalogSlug?: string }>(
  venues: readonly T[],
  shareId: string,
): T | undefined {
  return venues.find((venue) => launchVenueMatchesShareId(venue, shareId))
}
