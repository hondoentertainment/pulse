/**
 * Hop next — two Start-here rooms in the same neighborhood from catalog rank.
 * No GPS required. Guest-safe. Never invent rooms.
 */

import type { Venue } from './types'
import { listEmptySurgingStartHere } from './empty-surging'
import { neighborhoodSlug } from './neighborhood-pages'

export const HOP_NEXT_CTA = 'Hop next'
export const HOP_NEXT_COUNT = 2

export function listHopNextVenues(
  venues: readonly Venue[],
  currentVenue: Pick<Venue, 'id' | 'neighborhood'> | null | undefined,
  limit = HOP_NEXT_COUNT,
): Venue[] {
  if (!currentVenue) return []
  const hood = neighborhoodSlug(currentVenue.neighborhood)
  if (!hood) return []
  const pool = venues.filter((venue) => (
    venue.id !== currentVenue.id
    && neighborhoodSlug(venue.neighborhood) === hood
  ))
  return listEmptySurgingStartHere(pool, Math.max(limit, 3)).slice(0, limit)
}
