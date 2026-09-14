/**
 * Last 5 opened venues — guest-safe localStorage recents for Tonight/map.
 * No account required. No invented rooms.
 */

export const RECENT_VENUES_STORAGE_KEY = 'pulse_recent_venues_v1'
export const RECENT_VENUES_CAP = 5

export function sanitizeRecentVenueId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim()
  if (!id || id.length > 80) return null
  if (id.includes('://') || id.includes('/') || id.includes('\\')) return null
  return id
}

export function rememberOpenedVenue(
  venueId: string,
  store: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage,
): string[] {
  const id = sanitizeRecentVenueId(venueId)
  const next = id
    ? [id, ...readRecentVenueIds(store).filter((item) => item !== id)].slice(0, RECENT_VENUES_CAP)
    : readRecentVenueIds(store)
  try {
    store?.setItem(RECENT_VENUES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
  return next
}

export function readRecentVenueIds(
  store: Pick<Storage, 'getItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage,
): string[] {
  try {
    const raw = store?.getItem(RECENT_VENUES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const ids: string[] = []
    for (const item of parsed) {
      const id = sanitizeRecentVenueId(item)
      if (!id || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
      if (ids.length >= RECENT_VENUES_CAP) break
    }
    return ids
  } catch {
    return []
  }
}

export function listRecentVenues<T extends { id: string }>(
  venues: readonly T[],
  recentIds: readonly string[] = readRecentVenueIds(),
): T[] {
  const byId = new Map(venues.map((venue) => [venue.id, venue]))
  return recentIds
    .map((id) => byId.get(id))
    .filter((venue): venue is T => Boolean(venue))
}
