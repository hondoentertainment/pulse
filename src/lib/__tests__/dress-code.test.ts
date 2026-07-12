import { describe, it, expect } from 'vitest'
import {
  DRESS_CODE_OPTIONS,
  LIVE_DRESS_CODES,
  normalizeDressCode,
  formatDressCodeLabel,
} from '../dress-code'

describe('normalizeDressCode', () => {
  it('returns null for non-string input', () => {
    expect(normalizeDressCode(undefined)).toBeNull()
    expect(normalizeDressCode(null)).toBeNull()
    expect(normalizeDressCode(42)).toBeNull()
  })

  it('normalizes canonical underscore tokens', () => {
    expect(normalizeDressCode('casual')).toBe('casual')
    expect(normalizeDressCode('smart_casual')).toBe('smart_casual')
    expect(normalizeDressCode('costume_required')).toBe('costume_required')
  })

  it('normalizes legacy hyphenated / alias tokens', () => {
    expect(normalizeDressCode('smart-casual')).toBe('smart_casual')
    expect(normalizeDressCode('dressy')).toBe('upscale')
    expect(normalizeDressCode('no-code')).toBe('no_code')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeDressCode('  CASUAL  ')).toBe('casual')
    expect(normalizeDressCode('Smart-Casual')).toBe('smart_casual')
  })

  it('returns null for unrecognized tokens', () => {
    expect(normalizeDressCode('cocktail-attire')).toBeNull()
  })
})

describe('formatDressCodeLabel', () => {
  it('returns Unknown for unrecognized / missing input', () => {
    expect(formatDressCodeLabel(null)).toBe('Unknown')
    expect(formatDressCodeLabel(undefined)).toBe('Unknown')
    expect(formatDressCodeLabel('made-up')).toBe('Unknown')
  })

  it('returns the human label for every canonical dress code', () => {
    for (const option of DRESS_CODE_OPTIONS) {
      expect(formatDressCodeLabel(option.value)).toBe(option.label)
    }
  })

  it('resolves legacy aliases to their canonical label', () => {
    expect(formatDressCodeLabel('dressy')).toBe('Upscale')
  })
})

describe('DRESS_CODE_OPTIONS / LIVE_DRESS_CODES', () => {
  it('cover the same set of codes', () => {
    const optionValues = DRESS_CODE_OPTIONS.map((o) => o.value).sort()
    const liveValues = [...LIVE_DRESS_CODES].sort()
    expect(optionValues).toEqual(liveValues)
  })
})
