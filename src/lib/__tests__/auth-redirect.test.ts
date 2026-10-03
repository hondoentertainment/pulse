// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authRedirectBaseUrl } from '../auth-redirect'

const originalLocation = window.location

describe('authRedirectBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('returns the mocked browser origin (never a hardcoded localhost)', () => {
    const origin = 'https://pulse-chi-nine.vercel.app'
    expect(authRedirectBaseUrl({ origin })).toBe(origin)
    expect(authRedirectBaseUrl({ origin })).not.toContain('localhost')
  })

  it('strips a trailing slash so Site URL and emailRedirectTo match', () => {
    expect(authRedirectBaseUrl({ origin: 'https://pulse-chi-nine.vercel.app/' })).toBe(
      'https://pulse-chi-nine.vercel.app',
    )
  })

  it('reads window.location.origin when no location is passed', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        origin: 'https://pulse-chi-nine.vercel.app',
        pathname: '/auth',
      },
    })

    expect(authRedirectBaseUrl()).toBe('https://pulse-chi-nine.vercel.app')
  })

  it('does not append the current path (avoids /auth falling off the allowlist)', () => {
    expect(
      authRedirectBaseUrl({ origin: 'https://pulse-chi-nine.vercel.app' }),
    ).toBe('https://pulse-chi-nine.vercel.app')
  })

  it('returns empty string when origin is missing', () => {
    expect(authRedirectBaseUrl(null)).toBe('')
    expect(authRedirectBaseUrl({ origin: '' })).toBe('')
  })
})
