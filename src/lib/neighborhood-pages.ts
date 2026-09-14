/**
 * Guest-safe neighborhood pages: /n/capitol-hill, /n/ballard, …
 * Slugs come from tags already on Seattle venues. No GPS. No second city.
 */

import type { Venue } from './types'
import { listEmptySurgingStartHere } from './empty-surging'
import { isDensityNeighborhood } from './seattle-density'
import { SEATTLE_LAUNCH_VENUES } from './seattle-launch-venues'

export interface NeighborhoodPageDef {
  slug: string
  name: string
}

/** Hoods already tagged on the Seattle launch + OSM catalog. Not a second city. */
export const SEATTLE_TAGGED_NEIGHBORHOODS = [
  'Capitol Hill',
  'Ballard',
  'Belltown',
  'Downtown',
  'Fremont',
  'West Seattle',
  'Queen Anne',
  'University District',
  'Georgetown',
  'SoDo',
  'Pioneer Square',
  'Greenwood',
  'Columbia City',
  'Phinney Ridge',
  'Lake City',
  'Beacon Hill',
  'South Lake Union',
  'Green Lake',
  'Rainier Valley',
  'Central District',
  'Northgate',
  'Magnolia',
  'International District',
  'Ravenna',
  'Wallingford',
] as const

export function neighborhoodSlug(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return null
  const slug = trimmed
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || null
}

function addTaggedHood(bySlug: Map<string, string>, name: string | null | undefined): void {
  const trimmed = (name ?? '').trim()
  const slug = neighborhoodSlug(trimmed)
  if (!trimmed || !slug) return
  if (!bySlug.has(slug)) bySlug.set(slug, trimmed)
}

export function listNeighborhoodPages(venues: readonly Venue[] = []): NeighborhoodPageDef[] {
  const bySlug = new Map<string, string>()
  for (const name of SEATTLE_TAGGED_NEIGHBORHOODS) addTaggedHood(bySlug, name)
  for (const venue of SEATTLE_LAUNCH_VENUES) addTaggedHood(bySlug, venue.neighborhood)
  for (const venue of venues) addTaggedHood(bySlug, venue.neighborhood)
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => {
      const density = Number(isDensityNeighborhood(b.name)) - Number(isDensityNeighborhood(a.name))
      if (density !== 0) return density
      return a.name.localeCompare(b.name)
    })
}

export function resolveNeighborhoodPage(slug: string): NeighborhoodPageDef | null {
  return findNeighborhoodPage([], slug)
}

export function findNeighborhoodPage(
  venues: readonly Venue[],
  slug: string,
): NeighborhoodPageDef | null {
  const needle = (slug ?? '').trim().toLowerCase()
  if (!needle) return null
  return listNeighborhoodPages(venues).find((page) => page.slug === needle) ?? null
}

export function listNeighborhoodVenues(
  venues: readonly Venue[],
  slug: string,
): Venue[] {
  const page = findNeighborhoodPage(venues, slug)
  if (!page) return []
  const pageSlug = page.slug
  return venues.filter((venue) => neighborhoodSlug(venue.neighborhood) === pageSlug)
}

export function neighborhoodPath(slug: string): string {
  return `/n/${slug}`
}

export function neighborhoodStartHere(venues: readonly Venue[], slug: string): Venue[] {
  return listEmptySurgingStartHere(listNeighborhoodVenues(venues, slug))
}
