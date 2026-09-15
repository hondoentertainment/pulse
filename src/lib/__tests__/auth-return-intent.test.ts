import { describe, expect, it } from 'vitest'
import {
  AUTH_PATH,
  buildAuthPath,
  consumeAuthReturnPath,
  parseAuthNext,
  parseComposeVenueId,
  persistAuthNext,
  sanitizeAuthNext,
  venueComposePath,
  wantsComposeOpen,
} from '../auth-return-intent'

function memoryStore(): Storage {
  const data: Record<string, string> = {}
  return {
    get length() { return Object.keys(data).length },
    clear() { for (const key of Object.keys(data)) delete data[key] },
    getItem(key) { return data[key] ?? null },
    key(index) { return Object.keys(data)[index] ?? null },
    removeItem(key) { delete data[key] },
    setItem(key, value) { data[key] = value },
  }
}

describe('auth return-to-intent', () => {
  it('sanitizes same-origin next paths and rejects open redirects', () => {
    expect(sanitizeAuthNext('/venue/neumos?compose=1')).toBe('/venue/neumos?compose=1')
    expect(sanitizeAuthNext('/?here=neumos')).toBe('/?here=neumos')
    expect(sanitizeAuthNext('https://evil.test/phish')).toBeNull()
    expect(sanitizeAuthNext('//evil.test')).toBeNull()
    expect(sanitizeAuthNext('/auth')).toBeNull()
    expect(sanitizeAuthNext('/auth?next=/venue/x')).toBeNull()
  })

  it('restores persisted next after magic-link lands on / with empty search', () => {
    const store = memoryStore()
    persistAuthNext('/venue/neumos?compose=1', store)
    expect(consumeAuthReturnPath({ search: '', store })).toBe('/venue/neumos?compose=1')
  })

  it('persists next=/venue/:id?compose=1 across /auth', () => {
    const store = memoryStore()
    expect(buildAuthPath('/venue/neumos?compose=1')).toBe(
      '/auth?next=%2Fvenue%2Fneumos%3Fcompose%3D1',
    )
    persistAuthNext('/venue/neumos?compose=1', store)
    expect(parseAuthNext('?next=%2Fvenue%2Fneumos%3Fcompose%3D1')).toBe('/venue/neumos?compose=1')
    expect(consumeAuthReturnPath({ search: '', store })).toBe('/venue/neumos?compose=1')
    expect(consumeAuthReturnPath({ search: '', store })).toBe('/')
  })

  it('parses compose intent on the venue or Tonight', () => {
    expect(venueComposePath('neumos')).toBe('/venue/neumos?compose=1')
    expect(parseComposeVenueId('/venue/neumos', '?compose=1')).toBe('neumos')
    expect(wantsComposeOpen('?compose=1')).toBe(true)
    expect(wantsComposeOpen('')).toBe(false)
    expect(buildAuthPath(null)).toBe(AUTH_PATH)
  })
})
