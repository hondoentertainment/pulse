/**
 * Fast guest-safe typeahead over the Seattle catalog.
 * Name + neighborhood only — no GPS required.
 */

import type { Venue } from './types'
import { isCuratedVenue } from './map-filters'

export const VENUE_SEARCH_PLACEHOLDER = 'Search venues or neighborhoods'
export const VENUE_SEARCH_LIMIT = 8

export interface VenueSearchHit {
  venue: Venue
  score: number
  matched: 'name' | 'neighborhood'
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function matchScore(haystack: string, query: string): number {
  if (!haystack) return 0
  if (haystack === query) return 100
  if (haystack.startsWith(query)) return 80
  const idx = haystack.indexOf(query)
  if (idx === -1) return 0
  return Math.max(20, 60 - idx)
}

/** Rank catalog venues by name, then neighborhood. Curated / claimed break ties. */
export function searchVenueCatalog(
  venues: readonly Venue[],
  query: string,
  limit = VENUE_SEARCH_LIMIT,
): VenueSearchHit[] {
  const needle = normalize(query)
  if (!needle) return []

  const hits: VenueSearchHit[] = []
  for (const venue of venues) {
    const nameScore = matchScore(normalize(venue.name), needle)
    const hoodScore = matchScore(normalize(venue.neighborhood), needle)
    const score = Math.max(nameScore, hoodScore * 0.85)
    if (score <= 0) continue
    const matched: VenueSearchHit['matched'] = nameScore >= hoodScore ? 'name' : 'neighborhood'
    const boost = (isCuratedVenue(venue) ? 6 : 0) + (venue.claimVerified ? 3 : 0)
    hits.push({ venue, score: score + boost, matched })
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (a.venue.name ?? '').localeCompare(b.venue.name ?? '')
  })
  return hits.slice(0, limit)
}

export function searchVenueResults(
  venues: readonly Venue[],
  query: string,
  limit = VENUE_SEARCH_LIMIT,
): Venue[] {
  return searchVenueCatalog(venues, query, limit).map((hit) => hit.venue)
}
