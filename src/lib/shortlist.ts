import type { Venue } from './types'
import { getEnergyLabel } from './pulse-engine'

export const SHORTLIST_MAX_VENUES = 5
export const SHORTLIST_QUERY_PARAM = 'v'
export const SHORTLIST_VOTES_PARAM = 'go'

/** Vote tallies keyed by venue id, carried in the share URL (`go=id:2,id2:1`). */
export type ShortlistVotes = Record<string, number>

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

/** Parse `go=id:2,id2:1` into vote tallies for venues in the shortlist. */
export function parseShortlistVotes(
  searchParams: URLSearchParams | string,
  venueIds?: string[],
): ShortlistVotes {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams)
      : searchParams
  const allowed = venueIds ? new Set(normalizeShortlistVenueIds(venueIds)) : null
  const votes: ShortlistVotes = {}
  const raw = params.get(SHORTLIST_VOTES_PARAM) ?? ''
  for (const entry of raw.split(',')) {
    const [id, countRaw] = entry.split(':').map((s) => s.trim())
    if (!id) continue
    if (allowed && !allowed.has(id)) continue
    const count = Number.parseInt(countRaw ?? '', 10)
    if (!Number.isFinite(count) || count <= 0) continue
    votes[id] = Math.min(count, 99)
  }
  return votes
}

function encodeShortlistVotes(votes: ShortlistVotes): string {
  return Object.entries(votes)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${encodeURIComponent(id)}:${count}`)
    .join(',')
}

/** Return new tallies with one vote added (or removed) for a venue. */
export function applyShortlistVote(
  votes: ShortlistVotes,
  venueId: string,
  delta: 1 | -1,
): ShortlistVotes {
  const next = { ...votes }
  const count = (next[venueId] ?? 0) + delta
  if (count <= 0) delete next[venueId]
  else next[venueId] = Math.min(count, 99)
  return next
}

/** Venue id with the most votes; null on empty or tie-less data. */
export function leadingShortlistVenueId(votes: ShortlistVotes): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [id, count] of Object.entries(votes)) {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  }
  return best
}

export function buildShortlistPath(
  venueIds: string[],
  votes?: ShortlistVotes,
): string {
  const ids = normalizeShortlistVenueIds(venueIds)
  if (ids.length === 0) return '/shortlist'
  let path = `/shortlist?${SHORTLIST_QUERY_PARAM}=${ids.map(encodeURIComponent).join(',')}`
  const encodedVotes = votes ? encodeShortlistVotes(votes) : ''
  if (encodedVotes) path += `&${SHORTLIST_VOTES_PARAM}=${encodedVotes}`
  return path
}

export function buildShortlistShareUrl(
  venueIds: string[],
  baseUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://pulse.app',
  votes?: ShortlistVotes,
): string {
  const path = buildShortlistPath(venueIds, votes)
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

export function buildShortlistShareText(
  venues: Venue[],
  votes?: ShortlistVotes,
): string {
  if (venues.length === 0) return 'My Pulse shortlist'
  const lines = venues.map((v) => {
    const label = getEnergyLabel(v.pulseScore)
    const voteCount = votes?.[v.id] ?? 0
    const votePart = voteCount > 0 ? ` · ${voteCount} say go` : ''
    return `• ${v.name} — ${label} (${v.pulseScore})${votePart}`
  })
  return `Tonight's shortlist on Pulse:\n${lines.join('\n')}`
}

export function buildShortlistClipboardText(
  venues: Venue[],
  shareUrl: string,
): string {
  return `${buildShortlistShareText(venues)}\n${shareUrl}`
}
