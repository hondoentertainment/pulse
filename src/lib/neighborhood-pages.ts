/**
 * Guest-safe neighborhood pages: /n/capitol-hill, /n/pearl-district, …
 * Slugs come from tags already on coast-city venues. No GPS. One slug, no second domain.
 */

import type { Venue } from './types'
import { listEmptySurgingStartHere } from './empty-surging'
import { isDensityNeighborhood } from './seattle-density'
import { SEATTLE_LAUNCH_VENUES } from './seattle-launch-venues'
import {
  listTaggedNeighborhoodPages,
  neighborhoodSlug,
  SEATTLE_TAGGED_NEIGHBORHOODS,
} from './neighborhood-slugs.js'

export { neighborhoodSlug, SEATTLE_TAGGED_NEIGHBORHOODS }

export interface NeighborhoodPageDef {
  slug: string
  name: string
  city: string
}

function addTaggedHood(
  bySlug: Map<string, { name: string; city: string }>,
  name: string | null | undefined,
  city: string | null | undefined,
): void {
  const trimmed = (name ?? '').trim()
  const slug = neighborhoodSlug(trimmed)
  if (!trimmed || !slug) return
  if (!bySlug.has(slug)) bySlug.set(slug, { name: trimmed, city: (city ?? 'Seattle').trim() || 'Seattle' })
}

export function listNeighborhoodPages(venues: readonly Venue[] = []): NeighborhoodPageDef[] {
  const bySlug = new Map<string, { name: string; city: string }>()
  for (const page of listTaggedNeighborhoodPages()) addTaggedHood(bySlug, page.name, page.city)
  for (const venue of SEATTLE_LAUNCH_VENUES) addTaggedHood(bySlug, venue.neighborhood, venue.city)
  for (const venue of venues) addTaggedHood(bySlug, venue.neighborhood, venue.city)
  return [...bySlug.entries()]
    .map(([slug, page]) => ({ slug, name: page.name, city: page.city }))
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
