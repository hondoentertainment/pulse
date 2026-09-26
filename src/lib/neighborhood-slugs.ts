/**
 * Seattle neighborhood slugs for share OG cards.
 *
 * No relative imports. Vercel compiles /api handlers to Node ESM and does not
 * rewrite extensionless specifiers inside src/lib, so this file must stay
 * self-contained. Pulling neighborhood-pages.js crashes the function at load
 * (`ERR_MODULE_NOT_FOUND` for ./empty-surging) before any HTML is written.
 */

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

export interface TaggedNeighborhoodPage {
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

export function listTaggedNeighborhoodPages(): TaggedNeighborhoodPage[] {
  const bySlug = new Map<string, string>()
  for (const name of SEATTLE_TAGGED_NEIGHBORHOODS) {
    const slug = neighborhoodSlug(name)
    if (slug && !bySlug.has(slug)) bySlug.set(slug, name)
  }
  return [...bySlug.entries()].map(([slug, name]) => ({ slug, name }))
}

/** Static Seattle hoods only. Same set as resolveNeighborhoodPage() with no extra venues. */
export function resolveTaggedNeighborhoodPage(slug: string): TaggedNeighborhoodPage | null {
  const needle = (slug ?? '').trim().toLowerCase()
  if (!needle) return null
  return listTaggedNeighborhoodPages().find((page) => page.slug === needle) ?? null
}

export function parseNeighborhoodShareSlug(
  raw: string | null | undefined,
): string | null {
  const slug = neighborhoodSlug(raw)
  if (!slug) return null
  return resolveTaggedNeighborhoodPage(slug)?.slug ?? null
}
