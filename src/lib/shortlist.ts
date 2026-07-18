import type { Venue } from './types'
import { getEnergyLabel } from './pulse-engine'

export const SHORTLIST_MAX_VENUES = 5
export const SHORTLIST_QUERY_PARAM = 'v'

export function normalizeShortlistVenueIds(venueIds: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of venueIds) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= SHORTLIST_MAX_VENUES) break
  }
  return out
}

/** Parse `?v=id1,id2` (or repeated `v`) into unique venue ids (max 5). */
export function parseShortlistVenueIds(
  searchParams: URLSearchParams | string,
): string[] {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams)
      : searchParams
  const fromCsv = params.get(SHORTLIST_QUERY_PARAM) ?? ''
  const parts = fromCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const repeated = params.getAll(SHORTLIST_QUERY_PARAM).flatMap((value) =>
    value.includes(',') ? value.split(',') : [value],
  )
  return normalizeShortlistVenueIds([...parts, ...repeated])
}

export function buildShortlistPath(venueIds: string[]): string {
  const ids = normalizeShortlistVenueIds(venueIds)
  if (ids.length === 0) return '/shortlist'
  return `/shortlist?${SHORTLIST_QUERY_PARAM}=${ids.map(encodeURIComponent).join(',')}`
}

export function buildShortlistShareUrl(
  venueIds: string[],
  baseUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://pulse.app',
): string {
  const path = buildShortlistPath(venueIds)
  const origin = baseUrl.replace(/\/$/, '')
  return `${origin}${path}`
}

export function resolveShortlistVenues(
  venueIds: string[],
  venues: Venue[],
): { venues: Venue[]; missingIds: string[] } {
  const byId = new Map(venues.map((v) => [v.id, v]))
  const resolved: Venue[] = []
  const missingIds: string[] = []
  for (const id of normalizeShortlistVenueIds(venueIds)) {
    const venue = byId.get(id)
    if (venue) resolved.push(venue)
    else missingIds.push(id)
  }
  return { venues: resolved, missingIds }
}

export function buildShortlistShareText(venues: Venue[]): string {
  if (venues.length === 0) return 'My Pulse shortlist'
  const lines = venues.map((v) => {
    const label = getEnergyLabel(v.pulseScore)
    return `• ${v.name} — ${label} (${v.pulseScore})`
  })
  return `Tonight's shortlist on Pulse:\n${lines.join('\n')}`
}

export function buildShortlistClipboardText(
  venues: Venue[],
  shareUrl: string,
): string {
  return `${buildShortlistShareText(venues)}\n${shareUrl}`
}
