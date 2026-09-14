/**
 * Guest-safe neighborhood pages: /n/capitol-hill, /n/ballard, …
 * Slugs come from tags already on venues. No GPS. No second city.
 */

import type { Venue } from './types'
import { listEmptySurgingStartHere } from './empty-surging'
import { isDensityNeighborhood } from './seattle-density'

export interface NeighborhoodPageDef {
  slug: string
  name: string
}

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

export function listNeighborhoodPages(venues: readonly Venue[]): NeighborhoodPageDef[] {
  const bySlug = new Map<string, string>()
  for (const venue of venues) {
    const name = venue.neighborhood?.trim()
    const slug = neighborhoodSlug(name)
    if (!name || !slug) continue
    if (!bySlug.has(slug)) bySlug.set(slug, name)
  }
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => {
      const density = Number(isDensityNeighborhood(b.name)) - Number(isDensityNeighborhood(a.name))
      if (density !== 0) return density
      return a.name.localeCompare(b.name)
    })
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
