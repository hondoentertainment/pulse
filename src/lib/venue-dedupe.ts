/**
 * Venue duplicate detection.
 *
 * Two heuristics flag a pair of venues as a likely duplicate:
 *   1. `same_name`               — normalized names are identical.
 *   2. `proximity_similar_name`  — venues are within `PROXIMITY_METERS` of
 *      each other AND their names are "similar" (substring match or a
 *      Levenshtein distance within 25% of the longer name's length).
 *
 * Pairs are merged into connected-component groups (union-find) so that a
 * chain of near-duplicates (A~B, B~C) surfaces as a single group [A, B, C]
 * rather than two overlapping pairs. Only groups with 2+ venues are
 * returned — no false "singleton" noise for admins to wade through.
 *
 * This module is intentionally self-contained (no server-only imports) so
 * it can run both in the admin API (`api/admin/venue-duplicates.ts`) and,
 * if useful later, directly in the client bundle.
 */
import type { Venue } from './types'

export const PROXIMITY_METERS = 100
const SIMILARITY_MAX_EDIT_RATIO = 0.25

export type DuplicateReason = 'same_name' | 'proximity_similar_name'

export interface DuplicateGroup {
  /** Deterministic id derived from the sorted member venue ids. */
  id: string
  venues: Venue[]
  reasons: DuplicateReason[]
}

/**
 * Lowercases, strips diacritics/punctuation, drops leading articles, and
 * collapses whitespace so "The Crocodile", "Crocodile", and "El Crocodile!"
 * all normalize toward comparable tokens.
 */
export function normalizeVenueName(name: string | undefined | null): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Haversine distance in meters between two lat/lng points. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Classic O(n*m) edit-distance DP. Inputs are expected to already be short (venue names). */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const rows = a.length + 1
  const cols = b.length + 1
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i++) dp[i][0] = i
  for (let j = 0; j < cols; j++) dp[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp[rows - 1][cols - 1]
}

/** True when two raw venue names normalize to the same string. */
export function namesMatchExactly(nameA: string | undefined | null, nameB: string | undefined | null): boolean {
  const a = normalizeVenueName(nameA)
  const b = normalizeVenueName(nameB)
  return a.length > 0 && a === b
}

/**
 * True when two names are "close enough" to suspect a duplicate, but not
 * necessarily byte-identical: one contains the other, or the edit distance
 * is within `SIMILARITY_MAX_EDIT_RATIO` of the longer normalized name.
 */
export function namesAreSimilar(nameA: string | undefined | null, nameB: string | undefined | null): boolean {
  const a = normalizeVenueName(nameA)
  const b = normalizeVenueName(nameB)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true

  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return false
  const distance = levenshteinDistance(a, b)
  return distance / maxLen <= SIMILARITY_MAX_EDIT_RATIO
}

interface PairMatch {
  reason: DuplicateReason
}

function matchVenuePair(a: Venue, b: Venue): PairMatch | null {
  if (namesMatchExactly(a.name, b.name)) {
    return { reason: 'same_name' }
  }

  const latA = a.location?.lat
  const lngA = a.location?.lng
  const latB = b.location?.lat
  const lngB = b.location?.lng
  if (
    typeof latA === 'number' &&
    typeof lngA === 'number' &&
    typeof latB === 'number' &&
    typeof lngB === 'number' &&
    Number.isFinite(latA) &&
    Number.isFinite(lngA) &&
    Number.isFinite(latB) &&
    Number.isFinite(lngB)
  ) {
    const distance = haversineMeters(latA, lngA, latB, lngB)
    if (distance <= PROXIMITY_METERS && namesAreSimilar(a.name, b.name)) {
      return { reason: 'proximity_similar_name' }
    }
  }

  return null
}

/**
 * Groups venues into duplicate clusters via union-find over pairwise
 * matches. Deterministic ordering: groups are sorted largest-first, ties
 * broken by the group's id (sorted, pipe-joined member ids) so repeated
 * calls on the same input always return the same shape — useful for
 * snapshot-style admin UI tests.
 */
export function findDuplicateGroups(venues: Venue[]): DuplicateGroup[] {
  const n = venues.length
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }

  function union(a: number, b: number): void {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootA] = rootB
  }

  const pairReasons = new Map<string, Set<DuplicateReason>>()

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const match = matchVenuePair(venues[i], venues[j])
      if (!match) continue
      union(i, j)
      const key = `${i}-${j}`
      const existing = pairReasons.get(key) ?? new Set<DuplicateReason>()
      existing.add(match.reason)
      pairReasons.set(key, existing)
    }
  }

  const componentIndices = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const bucket = componentIndices.get(root) ?? []
    bucket.push(i)
    componentIndices.set(root, bucket)
  }

  const groups: DuplicateGroup[] = []
  for (const indices of componentIndices.values()) {
    if (indices.length < 2) continue

    const reasons = new Set<DuplicateReason>()
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const lo = Math.min(indices[a], indices[b])
        const hi = Math.max(indices[a], indices[b])
        const found = pairReasons.get(`${lo}-${hi}`)
        found?.forEach((r) => reasons.add(r))
      }
    }

    const groupVenues = indices.map((i) => venues[i])
    const id = groupVenues
      .map((v) => v.id)
      .filter(Boolean)
      .sort()
      .join('|')

    groups.push({
      id,
      venues: groupVenues,
      reasons: Array.from(reasons),
    })
  }

  groups.sort((a, b) => b.venues.length - a.venues.length || a.id.localeCompare(b.id))
  return groups
}
