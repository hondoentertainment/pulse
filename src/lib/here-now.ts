/**
 * 90-minute “here now” presence. Count is public; names only for followed people.
 */

export const HERE_NOW_WINDOW_MS = 90 * 60 * 1000
export const HERE_NOW_LABEL = 'here now'

export interface HereNowFriend {
  userId: string
  username: string | null
}

export interface HereNowSummary {
  count: number
  friends: HereNowFriend[]
}

export function isPresenceActive(
  checkedInAt: string | Date,
  leftAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (leftAt) return false
  const start = typeof checkedInAt === 'string' ? Date.parse(checkedInAt) : checkedInAt.getTime()
  if (!Number.isFinite(start)) return false
  return nowMs - start < HERE_NOW_WINDOW_MS && nowMs >= start
}

export function presenceExpiresAt(checkedInAt: string | Date): string {
  const start = typeof checkedInAt === 'string' ? Date.parse(checkedInAt) : checkedInAt.getTime()
  return new Date(start + HERE_NOW_WINDOW_MS).toISOString()
}

export function formatHereNowCount(count: number): string {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return `0 ${HERE_NOW_LABEL}`
  return `${n} ${HERE_NOW_LABEL}`
}

export function friendNamesForViewer(
  people: readonly HereNowFriend[],
  followedUserIds: readonly string[],
): HereNowFriend[] {
  const followed = new Set(followedUserIds)
  return people.filter((person) => followed.has(person.userId))
}

export function emptyHereNow(): HereNowSummary {
  return { count: 0, friends: [] }
}
