/**
 * Venue cover — show a catalog photo on venue + OG ONLY if the row
 * already has a photo/image URL. Do not scrape or invent images.
 */

const IMAGE_KEYS = [
  'imageUrl',
  'image_url',
  'photoUrl',
  'photo_url',
  'coverUrl',
  'cover_url',
] as const

function looksLikeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function venueCoverUrl(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  for (const key of IMAGE_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && looksLikeHttpUrl(value.trim())) {
      return value.trim()
    }
  }
  return null
}

export function venueCoverOgImage(
  row: unknown,
  fallbackOg?: string | null,
): string {
  return venueCoverUrl(row) ?? fallbackOg ?? ''
}
