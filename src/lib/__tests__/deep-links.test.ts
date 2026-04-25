import { describe, it, expect } from 'vitest'
import { resolveDeepLink } from '@/hooks/use-deep-links'

describe('resolveDeepLink', () => {
  it('resolves pulse://venue/:id', () => {
    expect(resolveDeepLink('pulse://venue/abc-123')).toBe('/venue/abc-123')
  })

  it('resolves pulse://pulse/:id', () => {
    expect(resolveDeepLink('pulse://pulse/p42')).toBe('/?pulse=p42')
  })

  it('resolves pulse://crew/:id', () => {
    expect(resolveDeepLink('pulse://crew/crew1')).toBe('/crews?crew=crew1')
  })

  it('resolves pulse://event/:id', () => {
    expect(resolveDeepLink('pulse://event/evt9')).toBe('/events?event=evt9')
  })

  it('resolves pulse://safety/session/:id', () => {
    expect(resolveDeepLink('pulse://safety/session/s-xyz')).toBe('/?safety=s-xyz')
  })

  it('resolves Universal Link equivalents', () => {
    expect(resolveDeepLink('https://app.pulse.nightlife/venue/abc')).toBe('/venue/abc')
    expect(resolveDeepLink('https://app.pulse.nightlife/event/e1')).toBe('/events?event=e1')
  })

  it('returns null on unsupported paths', () => {
    expect(resolveDeepLink('pulse://unknown/thing')).toBeNull()
    expect(resolveDeepLink('not a url')).toBeNull()
    expect(resolveDeepLink('pulse://venue/')).toBeNull()
  })
})
