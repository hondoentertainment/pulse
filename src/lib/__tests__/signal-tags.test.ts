import { describe, expect, it } from 'vitest'
import {
  normalizeTag,
  addCustomTag,
  removeCustomTag,
  getAvailableTags,
  getTagsFromHistory,
  isBuiltInTag,
  BUILT_IN_TAGS,
  MAX_CUSTOM_TAGS,
  MAX_TAG_LENGTH,
} from '@/lib/signal-tags'

describe('normalizeTag', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeTag('  Gym  ')).toBe('gym')
    expect(normalizeTag('LATE   night')).toBe('late night')
  })

  it('collapses near-duplicates to one canonical tag', () => {
    const variants = ['Gym', 'gym ', ' GYM', 'gym']
    expect(new Set(variants.map(normalizeTag)).size).toBe(1)
  })

  it('strips punctuation that would fragment correlations', () => {
    expect(normalizeTag('caffeine!!!')).toBe('caffeine')
    expect(normalizeTag('#deadline')).toBe('deadline')
  })

  it('keeps digits and internal hyphens', () => {
    expect(normalizeTag('5k-run')).toBe('5k-run')
  })

  it('truncates to the max length', () => {
    expect(normalizeTag('a'.repeat(50))).toHaveLength(MAX_TAG_LENGTH)
  })

  it('returns empty string for unusable input', () => {
    for (const bad of ['', '   ', '!!!', '***']) {
      expect(normalizeTag(bad)).toBe('')
    }
  })
})

describe('addCustomTag', () => {
  it('adds a normalised tag', () => {
    const result = addCustomTag([], '  Gym ')
    expect(result).toEqual({ ok: true, tag: 'gym', tags: ['gym'] })
  })

  it('does not mutate the input list', () => {
    const existing: string[] = []
    addCustomTag(existing, 'gym')
    expect(existing).toEqual([])
  })

  it('rejects empty input', () => {
    expect(addCustomTag([], '   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects duplicates regardless of casing', () => {
    expect(addCustomTag(['gym'], 'GYM')).toEqual({ ok: false, reason: 'duplicate' })
  })

  it('rejects shadowing a built-in tag', () => {
    expect(addCustomTag([], 'Calm')).toEqual({ ok: false, reason: 'built_in' })
  })

  it('enforces the custom tag limit', () => {
    const full = Array.from({ length: MAX_CUSTOM_TAGS }, (_, i) => `tag${i}`)
    expect(addCustomTag(full, 'one-more')).toEqual({ ok: false, reason: 'limit' })
  })
})

describe('removeCustomTag', () => {
  it('removes by normalised value', () => {
    expect(removeCustomTag(['gym', 'coffee'], ' GYM ')).toEqual(['coffee'])
  })

  it('is a no-op for unknown tags', () => {
    expect(removeCustomTag(['gym'], 'nope')).toEqual(['gym'])
  })
})

describe('getAvailableTags', () => {
  it('lists built-ins first, then custom tags', () => {
    const tags = getAvailableTags(['gym', 'coffee'])
    expect(tags.slice(0, BUILT_IN_TAGS.length)).toEqual([...BUILT_IN_TAGS])
    expect(tags.slice(BUILT_IN_TAGS.length)).toEqual(['gym', 'coffee'])
  })

  it('never duplicates a built-in that leaked into custom storage', () => {
    const tags = getAvailableTags(['calm', 'gym'])
    expect(tags.filter((t) => t === 'calm')).toHaveLength(1)
    expect(tags).toContain('gym')
  })

  it('drops unusable custom entries', () => {
    expect(getAvailableTags(['', '   ', '!!!'])).toEqual([...BUILT_IN_TAGS])
  })

  it('returns just the built-ins when there are no custom tags', () => {
    expect(getAvailableTags([])).toEqual([...BUILT_IN_TAGS])
  })

  it('recovers tags seen in history but missing from local custom storage', () => {
    // Simulates a second device: entries synced, custom-tag list did not.
    const tags = getAvailableTags([], ['gym', 'coffee'])
    expect(tags).toContain('gym')
    expect(tags).toContain('coffee')
  })

  it('does not duplicate a tag present in both custom storage and history', () => {
    const tags = getAvailableTags(['gym'], ['gym', 'coffee'])
    expect(tags.filter((t) => t === 'gym')).toHaveLength(1)
    expect(tags).toContain('coffee')
  })
})

describe('getTagsFromHistory', () => {
  it('collects distinct normalised tags, newest first', () => {
    const entries = [
      { tags: ['Gym', 'coffee'] },
      { tags: ['gym ', 'late night'] },
    ]
    expect(getTagsFromHistory(entries)).toEqual(['gym', 'coffee', 'late night'])
  })

  it('ignores unusable tags', () => {
    expect(getTagsFromHistory([{ tags: ['', '  ', '!!!'] }])).toEqual([])
  })

  it('returns empty for no entries', () => {
    expect(getTagsFromHistory([])).toEqual([])
  })
})

describe('isBuiltInTag', () => {
  it('identifies built-ins regardless of formatting', () => {
    expect(isBuiltInTag(' Calm ')).toBe(true)
    expect(isBuiltInTag('gym')).toBe(false)
  })
})
