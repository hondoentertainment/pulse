/**
 * Tag vocabulary.
 *
 * The check-in shipped with six hardcoded tags
 * (`calm/clear/tired/stressed/social/active`). Since the whole payoff of the
 * product is correlating tags with score, that fixed vocabulary capped how much
 * anyone could learn — nobody could track "caffeine", "gym", "alcohol", or
 * "deadline", which are exactly the things that move a day.
 *
 * Custom tags are stored per user and merged with the built-ins. Normalisation
 * lives here so the same rules apply at entry time and at correlation time —
 * "Gym", "gym " and "GYM" must be one tag or the pattern engine splits the
 * signal across near-duplicates.
 */

/** Tags every user starts with. */
export const BUILT_IN_TAGS = ['calm', 'clear', 'tired', 'stressed', 'social', 'active'] as const

/** Max tags selectable on a single check-in. */
export const MAX_TAGS_PER_ENTRY = 3

/** Max custom tags a user may keep, to stop the picker becoming unusable. */
export const MAX_CUSTOM_TAGS = 12

/** Max characters in a tag. */
export const MAX_TAG_LENGTH = 20

/**
 * Canonical form of a tag: trimmed, lowercased, inner whitespace collapsed,
 * and stripped of characters that would make correlation output noisy.
 * Returns '' when nothing usable remains.
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Keep letters, numbers, spaces and internal hyphens; drop the rest.
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim()
}

export type AddTagResult =
  | { ok: true; tag: string; tags: string[] }
  | { ok: false; reason: 'empty' | 'duplicate' | 'built_in' | 'limit' }

/**
 * Add a custom tag to the user's list. Pure — returns the next list rather
 * than mutating, so the store and tests share identical behaviour.
 */
export function addCustomTag(existing: string[], raw: string): AddTagResult {
  const tag = normalizeTag(raw)
  if (!tag) return { ok: false, reason: 'empty' }
  if ((BUILT_IN_TAGS as readonly string[]).includes(tag)) return { ok: false, reason: 'built_in' }
  if (existing.includes(tag)) return { ok: false, reason: 'duplicate' }
  if (existing.length >= MAX_CUSTOM_TAGS) return { ok: false, reason: 'limit' }
  return { ok: true, tag, tags: [...existing, tag] }
}

/** Remove a custom tag (normalising first so callers can pass raw input). */
export function removeCustomTag(existing: string[], raw: string): string[] {
  const tag = normalizeTag(raw)
  return existing.filter((item) => item !== tag)
}

/**
 * Full vocabulary shown in the picker: built-ins first (stable, familiar
 * ordering), then the user's own, de-duplicated.
 *
 * `historyTags` are tags observed on existing entries. Including them makes the
 * picker self-healing across devices: the custom-tag list is stored locally, but
 * entries sync, so a tag invented on one device still reappears on another
 * instead of silently vanishing from the picker while living on in the data.
 */
export function getAvailableTags(customTags: string[], historyTags: string[] = []): string[] {
  const seen = new Set<string>(BUILT_IN_TAGS)
  const collect = (source: string[]) =>
    source.map(normalizeTag).filter((tag) => {
      if (!tag || seen.has(tag)) return false
      seen.add(tag)
      return true
    })

  return [...BUILT_IN_TAGS, ...collect(customTags), ...collect(historyTags)]
}

/** Distinct tags appearing on existing entries, newest usage first. */
export function getTagsFromHistory(entries: Array<{ tags: string[] }>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of entries) {
    for (const raw of entry.tags) {
      const tag = normalizeTag(raw)
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      result.push(tag)
    }
  }
  return result
}

/** Whether a tag is one of the built-ins (used to block deleting them). */
export function isBuiltInTag(tag: string): boolean {
  return (BUILT_IN_TAGS as readonly string[]).includes(normalizeTag(tag))
}
