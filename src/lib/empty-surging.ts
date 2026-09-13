/**
 * Honest empty Surging / Live now — catalog Start here, never a fake crowd.
 */

import type { Venue } from './types'
import { filterTonightCatalog } from './catalog-quality'
import { isCuratedVenue } from './map-filters'

export const EMPTY_SURGING_HEADLINE = 'Quiet nearby — no live reviews in the last hour.'
export const EMPTY_SURGING_BODY =
  'We never invent a surge. Start at a real Seattle room, then I’m here · Pulse when you’re there.'
export const EMPTY_SURGING_CTA = 'Be the first · Pulse'
export const EMPTY_SURGING_START_HERE = 'Start here'
export const EMPTY_SURGING_MIN = 3
export const EMPTY_SURGING_MAX = 5

function startHereScore(venue: Venue): number {
  let score = 0
  if (isCuratedVenue(venue)) score += 12
  if (venue.claimVerified) score += 8
  if (venue.seeded) score += 4
  if ((venue.neighborhood ?? '').trim()) score += 1
  return score
}

/** 3–5 catalog rooms. Prefer Launch 33 / curated / claimed. No invented energy. */
export function listEmptySurgingStartHere(
  venues: readonly Venue[],
  limit = EMPTY_SURGING_MAX,
): Venue[] {
  const catalog = filterTonightCatalog([...venues])
  const cap = Math.min(EMPTY_SURGING_MAX, Math.max(EMPTY_SURGING_MIN, limit))
  return [...catalog]
    .sort((a, b) => {
      const scoreDiff = startHereScore(b) - startHereScore(a)
      if (scoreDiff !== 0) return scoreDiff
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
    .slice(0, cap)
}

export function emptySurgingPulseHref(input: {
  isPlaceholder: boolean
  hasSession: boolean
  venueId: string
}): { kind: 'compose'; venueId: string } | { kind: 'auth' } {
  if (input.isPlaceholder || input.hasSession) {
    return { kind: 'compose', venueId: input.venueId }
  }
  return { kind: 'auth' }
}
