/**
 * Neighborhood share + OG via the existing /api/share/venue and /api/share/og path.
 * Pretty URL stays /n/:slug so a group chat can drop it.
 */

import { getPublicAppOrigin } from './sharing'
import { neighborhoodPath, neighborhoodSlug, resolveNeighborhoodPage } from './neighborhood-pages'

export const NEIGHBORHOOD_SHARE_QUERY = 'n'

export function parseNeighborhoodShareSlug(
  raw: string | null | undefined,
): string | null {
  const slug = neighborhoodSlug(raw)
  if (!slug) return null
  return resolveNeighborhoodPage(slug)?.slug ?? null
}

export function getNeighborhoodShareLandingPath(slug: string): string {
  const page = resolveNeighborhoodPage(slug)
  return neighborhoodPath(page?.slug ?? neighborhoodSlug(slug) ?? slug)
}

export function getNeighborhoodSharePreviewUrl(
  slug: string,
  baseUrl: string = getPublicAppOrigin(),
): string {
  const safe = parseNeighborhoodShareSlug(slug) ?? neighborhoodSlug(slug) ?? slug
  return `${baseUrl.replace(/\/$/, '')}/api/share/venue?${NEIGHBORHOOD_SHARE_QUERY}=${encodeURIComponent(safe)}`
}

export function getNeighborhoodShareOgImageUrl(
  slug: string,
  baseUrl: string = getPublicAppOrigin(),
): string {
  const safe = parseNeighborhoodShareSlug(slug) ?? neighborhoodSlug(slug) ?? slug
  return `${baseUrl.replace(/\/$/, '')}/api/share/og?${NEIGHBORHOOD_SHARE_QUERY}=${encodeURIComponent(safe)}`
}

export function getNeighborhoodPrettyShareUrl(
  slug: string,
  baseUrl: string = getPublicAppOrigin(),
): string {
  return `${baseUrl.replace(/\/$/, '')}${getNeighborhoodShareLandingPath(slug)}`
}

export const NEIGHBORHOOD_SHARE_COPY = {
  cta: 'Share hood',
  title: 'Tonight on Pulse',
} as const
