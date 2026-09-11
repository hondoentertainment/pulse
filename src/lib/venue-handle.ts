/** X-style @handle from a venue name. Never invents a venue — only slugs the given name. */
export function venueHandle(name: string | null | undefined): string {
  const slug = (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 15)
  return `@${slug || 'venue'}`
}

/** X-style @handle for a pulse author. Falls back to the venue handle. */
export function authorHandle(
  username: string | null | undefined,
  venueName?: string | null,
): string {
  const raw = (username ?? '').trim()
  if (raw) return raw.startsWith('@') ? raw : `@${raw}`
  return venueHandle(venueName)
}

export function displayInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}
