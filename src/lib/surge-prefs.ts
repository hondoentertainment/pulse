/**
 * Local surge-push prefs. Server columns are the source of truth for delivery.
 * Missing VAPID keys still no-op the send.
 */

export const QUIET_HOURS_STORAGE_KEY = 'pulse:surge-quiet-hours'
export const SURGE_MUTE_STORAGE_KEY = 'pulse:surge-muted-venues'

export interface QuietHours {
  start: number | null
  end: number | null
}

export function parseQuietHours(raw: string | null): QuietHours {
  if (!raw) return { start: null, end: null }
  try {
    const parsed = JSON.parse(raw) as { start?: unknown; end?: unknown }
    return {
      start: hourOrNull(parsed.start),
      end: hourOrNull(parsed.end),
    }
  } catch {
    return { start: null, end: null }
  }
}

export function hourOrNull(value: unknown): number | null {
  const hour = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  return hour
}

export function readQuietHours(
  store: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
): QuietHours {
  if (!store) return { start: null, end: null }
  return parseQuietHours(store.getItem(QUIET_HOURS_STORAGE_KEY))
}

export function writeQuietHours(
  hours: QuietHours,
  store: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  store?.setItem(QUIET_HOURS_STORAGE_KEY, JSON.stringify({
    start: hourOrNull(hours.start),
    end: hourOrNull(hours.end),
  }))
}

function readMuted(
  store: Pick<Storage, 'getItem'> | null,
): string[] {
  if (!store) return []
  try {
    const parsed = JSON.parse(store.getItem(SURGE_MUTE_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function isVenueSurgeMuted(
  venueId: string,
  store: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
): boolean {
  return readMuted(store).includes(venueId)
}

export function writeVenueSurgeMuted(
  venueId: string,
  muted: boolean,
  store: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
): boolean {
  if (!store) return false
  const next = new Set(readMuted(store))
  if (muted) next.add(venueId)
  else next.delete(venueId)
  store.setItem(SURGE_MUTE_STORAGE_KEY, JSON.stringify([...next]))
  return muted
}
