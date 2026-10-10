/**
 * Heading there + hop share.
 * The short link is /venue/:id?hop=1. Crawlers already rewrite /venue/:id
 * to /api/share/venue, and that route keeps hop=1 so humans land on the banner.
 */

export const HOP_QUERY = 'hop'
export const HOP_ACTIVE = '1'
export const HEADING_ID_QUERY = 'h'
export const HEADING_WINDOW_MS = 8 * 60 * 60 * 1000

export interface HeadingRecord {
  id?: string
  userId: string
  venueId: string
  displayName: string
  createdAt: string
  cancelledAt?: string | null
}

export function isHopArrival(search: string | { get(name: string): string | null }): boolean {
  const value = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(HOP_QUERY)
    : search.get(HOP_QUERY)
  return value === HOP_ACTIVE
}

/** Public hop id. Launch rooms keep their short slug (`sf-chapel`) on the link. */
export function headingVenueKey(venue: { id: string; catalogSlug?: string | null }): string {
  const slug = venue.catalogSlug?.trim()
  return slug || venue.id
}

export function newHeadingId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function readHeadingId(search: string | { get(name: string): string | null }): string | null {
  const value = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(HEADING_ID_QUERY)
    : search.get(HEADING_ID_QUERY)
  const id = value?.trim() ?? ''
  if (!id || id.length > 80 || /[^a-zA-Z0-9_-]/.test(id)) return null
  return id
}

export function hopLandingPath(venueId: string, headingId?: string | null): string {
  const path = `/venue/${encodeURIComponent(venueId)}?${HOP_QUERY}=${HOP_ACTIVE}`
  if (!headingId) return path
  return `${path}&${HEADING_ID_QUERY}=${encodeURIComponent(headingId)}`
}

function hopOrigin(origin?: string): string {
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, '')
  if (typeof window !== 'undefined' && /^https?:\/\//.test(window.location.origin)) {
    return window.location.origin.replace(/\/$/, '')
  }
  return 'https://pulse-chi-nine.vercel.app'
}

export function absoluteHopLink(venueId: string, origin?: string, headingId?: string | null): string {
  return `${hopOrigin(origin)}${hopLandingPath(venueId, headingId)}`
}

/** OG/crawler URL. Humans are redirected to hopLandingPath. */
export function hopSharePreviewUrl(venueId: string, origin?: string, headingId?: string | null): string {
  const base = `${hopOrigin(origin)}/api/share/venue?venueId=${encodeURIComponent(venueId)}&${HOP_QUERY}=${HOP_ACTIVE}`
  if (!headingId) return base
  return `${base}&${HEADING_ID_QUERY}=${encodeURIComponent(headingId)}`
}

export function headingWriteAction(input: {
  isPlaceholder: boolean
  hasSession: boolean
  next?: string | null
}): { type: 'auth'; path: string } | { type: 'save' } {
  if (input.isPlaceholder || input.hasSession) return { type: 'save' }
  const next = input.next?.trim() ?? ''
  const safe = next.startsWith('/')
    && !next.startsWith('//')
    && !next.includes('://')
    && !next.includes('\\')
    && next.length <= 240
    && next !== '/auth'
    && !next.startsWith('/auth?')
  if (!safe) return { type: 'auth', path: '/auth' }
  return { type: 'auth', path: `/auth?next=${encodeURIComponent(next)}` }
}

export function buildHeadingRecord(input: {
  userId: string
  venueId: string
  displayName: string
  now?: Date
  id?: string
}): HeadingRecord {
  const name = input.displayName.trim() || 'Someone'
  return {
    id: input.id ?? newHeadingId(),
    userId: input.userId,
    venueId: input.venueId,
    displayName: name.slice(0, 40),
    createdAt: (input.now ?? new Date()).toISOString(),
    cancelledAt: null,
  }
}

export function isHeadingActive(
  record: Pick<HeadingRecord, 'createdAt' | 'cancelledAt'>,
  nowMs: number = Date.now(),
  windowMs: number = HEADING_WINDOW_MS,
): boolean {
  if (record.cancelledAt) return false
  const created = Date.parse(record.createdAt)
  if (!Number.isFinite(created)) return false
  return created <= nowMs && nowMs - created <= windowMs
}

export function pickActiveHeading(
  records: readonly HeadingRecord[],
  venueId: string,
  nowMs: number = Date.now(),
): HeadingRecord | null {
  const active = records
    .filter((record) => record.venueId === venueId && isHeadingActive(record, nowMs))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return active[0] ?? null
}

export function headingButtonLabel(input: {
  hop: boolean
  selfActive: boolean
}): string {
  if (input.selfActive) return 'Heading there'
  if (input.hop) return 'Heading there too'
  return 'Heading there'
}

export function headingById(
  records: readonly HeadingRecord[],
  venueId: string,
  headingId: string,
  nowMs: number = Date.now(),
): HeadingRecord | null {
  return records.find((record) =>
    record.id === headingId
    && record.venueId === venueId
    && isHeadingActive(record, nowMs),
  ) ?? null
}

export function headingBannerCopy(input: {
  displayName?: string | null
  place?: string | null
  createdAt?: string | null
  nowMs?: number
  ended?: boolean
}): { title: string; meta: string } {
  if (input.ended) {
    return { title: 'This hop link has ended', meta: 'From a hop link' }
  }
  const name = input.displayName?.trim()
  const title = name ? `${name} is heading here` : 'Someone is heading here'
  const place = input.place?.trim()
  const freshness = headingFreshness(input.createdAt, input.nowMs ?? Date.now())
  const meta = ['From a hop link', place, freshness].filter(Boolean).join(' · ')
  return { title, meta }
}

export function headingFreshness(createdAt: string | null | undefined, nowMs: number): string {
  if (!createdAt) return 'just now'
  const then = Date.parse(createdAt)
  if (!Number.isFinite(then)) return 'just now'
  const mins = Math.floor((nowMs - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export function buildHopOgCopy(input: {
  venueName?: string | null
  displayName?: string | null
}): { title: string; description: string; energyLine: string } {
  const venue = input.venueName?.trim() || 'this room'
  const name = input.displayName?.trim()
  const title = name ? `${name} is heading to ${venue}` : `Heading to ${venue}`
  return {
    title,
    description: `Friends who open this hop link see you're on the way to ${venue}, then tap I'm here when they arrive.`,
    energyLine: 'Pulse · Heading there',
  }
}

export function hopShareText(input: { displayName: string; venueName: string; url: string }): string {
  const name = input.displayName.trim() || 'Someone'
  const venue = input.venueName.trim() || 'this room'
  return `${name} is heading to ${venue} — ${input.url}`
}

export function hopTextInviteHref(input: { displayName: string; venueName: string; url: string }): string {
  return `sms:?&body=${encodeURIComponent(hopShareText(input))}`
}
