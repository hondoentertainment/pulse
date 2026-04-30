const STORAGE_KEY = 'pulse:surge-watch-venues'

function canReadStorage(storage?: Pick<Storage, 'getItem'> | null): storage is Pick<Storage, 'getItem'> {
  return Boolean(storage)
}

function canWriteStorage(storage?: Pick<Storage, 'getItem' | 'setItem'> | null): storage is Pick<Storage, 'getItem' | 'setItem'> {
  return Boolean(storage)
}

function parseStoredIds(raw: string | null): string[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

export function getWatchedVenueIds(storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): string[] {
  if (!canReadStorage(storage)) return []
  return parseStoredIds(storage.getItem(STORAGE_KEY))
}

export function isVenueSurgeWatched(
  venueId: string,
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): boolean {
  return getWatchedVenueIds(storage).includes(venueId)
}

export function toggleVenueSurgeWatch(
  venueId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): boolean {
  if (!canWriteStorage(storage)) return false

  const current = new Set(getWatchedVenueIds(storage))
  if (current.has(venueId)) {
    current.delete(venueId)
  } else {
    current.add(venueId)
  }

  storage.setItem(STORAGE_KEY, JSON.stringify([...current]))
  return current.has(venueId)
}
