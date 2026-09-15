/**
 * My night — signed-in pin of 2–3 rooms. Reuses follows.pinned_at.
 */

export const MY_NIGHT_PIN_CAP = 3

export interface MyNightPin {
  venueId: string
  pinnedAt: string
}

export function canPinMyNight(pinnedCount: number, alreadyPinned: boolean): boolean {
  if (alreadyPinned) return true
  return pinnedCount < MY_NIGHT_PIN_CAP
}

export function nextPinnedVenueIds(
  pinnedVenueIds: readonly string[],
  venueId: string,
  cap = MY_NIGHT_PIN_CAP,
): { ids: string[]; didPin: boolean; atCap: boolean } {
  if (pinnedVenueIds.includes(venueId)) {
    return { ids: pinnedVenueIds.filter((id) => id !== venueId), didPin: false, atCap: false }
  }
  if (pinnedVenueIds.length >= cap) {
    return { ids: [...pinnedVenueIds], didPin: false, atCap: true }
  }
  return { ids: [...pinnedVenueIds, venueId], didPin: true, atCap: false }
}

export function orderVenuesPinnedFirst<T extends { id: string }>(
  venues: readonly T[],
  pinnedVenueIds: readonly string[],
): T[] {
  const pinned = new Set(pinnedVenueIds)
  return [...venues].sort((a, b) => {
    const pinDiff = Number(pinned.has(b.id)) - Number(pinned.has(a.id))
    if (pinDiff !== 0) return pinDiff
    return 0
  })
}

export function orderFollowingRowsPinnedFirst<T extends { venue: { id: string } }>(
  rows: readonly T[],
  pinnedVenueIds: readonly string[],
): T[] {
  const pinned = new Set(pinnedVenueIds)
  return [...rows].sort((a, b) => Number(pinned.has(b.venue.id)) - Number(pinned.has(a.venue.id)))
}
