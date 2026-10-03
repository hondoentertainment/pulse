/**
 * Seattle nightlife density — treat Ballard, Georgetown, SoDo like Capitol Hill.
 * Launch-33-style curated preference when tagged. No second city. No OSM deletes.
 */

import type { Venue } from './types'
import { isCuratedVenue } from './map-filters'

export const SEATTLE_DENSITY_NEIGHBORHOODS = [
  'Capitol Hill',
  'Ballard',
  'Georgetown',
  'SoDo',
] as const

export type SeattleDensityNeighborhood = (typeof SEATTLE_DENSITY_NEIGHBORHOODS)[number]

const DENSITY_SET = new Set<string>(
  SEATTLE_DENSITY_NEIGHBORHOODS.map((name) => name.toLowerCase()),
)

export function normalizeNeighborhoodName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  if (/^sodo$/i.test(trimmed) || /^so-do$/i.test(trimmed)) return 'SoDo'
  if (/^capitol\s*hill$/i.test(trimmed)) return 'Capitol Hill'
  return trimmed
}

export function isDensityNeighborhood(name: string | null | undefined): boolean {
  const normalized = normalizeNeighborhoodName(name)
  return DENSITY_SET.has(normalized.toLowerCase())
}

/** Ranking boost used by Tonight / search when a pin is in a density hood. */
export function densityRankBoost(venue: Pick<Venue, 'neighborhood' | 'inventorySource' | 'seeded' | 'claimVerified'>): number {
  if (!isDensityNeighborhood(venue.neighborhood)) return 0
  let score = 8
  if (isCuratedVenue(venue)) score += 6
  if (venue.claimVerified) score += 3
  return score
}
