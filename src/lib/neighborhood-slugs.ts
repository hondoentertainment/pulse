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

export const PORTLAND_TAGGED_NEIGHBORHOODS = [
  'Pearl District',
  'Old Town',
  'Mississippi',
  'Alberta',
  'Hawthorne',
  'Buckman',
  'Kerns',
  'Eliot',
  'Brooklyn',
] as const

export const SAN_FRANCISCO_TAGGED_NEIGHBORHOODS = [
  'Mission',
  'Castro',
  'SoMa',
  'North Beach',
  'Haight-Ashbury',
  'Marina',
  'Hayes Valley',
  'Tenderloin',
] as const

export interface TaggedNeighborhoodPage {
  slug: string
  name: string
  city: string
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
  const rows: Array<{ name: string; city: string }> = [
    ...SEATTLE_TAGGED_NEIGHBORHOODS.map((name) => ({ name, city: 'Seattle' })),
    ...PORTLAND_TAGGED_NEIGHBORHOODS.map((name) => ({ name, city: 'Portland' })),
    ...SAN_FRANCISCO_TAGGED_NEIGHBORHOODS.map((name) => ({ name, city: 'San Francisco' })),
  ]
  const bySlug = new Map<string, { name: string; city: string }>()
  for (const row of rows) {
    const slug = neighborhoodSlug(row.name)
    if (slug && !bySlug.has(slug)) bySlug.set(slug, row)
  }
  return [...bySlug.entries()].map(([slug, row]) => ({ slug, name: row.name, city: row.city }))
}

/** Tagged hoods on the coast index. Same slugs as /n/:slug. No second domain. */
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
