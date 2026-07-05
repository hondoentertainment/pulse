import { describe, expect, it, vi } from 'vitest'

describe('app-mode', () => {
  it('defaults to venue when VITE_APP_MODE is unset', async () => {
    vi.stubEnv('VITE_APP_MODE', '')
    vi.resetModules()
    const mod = await import('@/lib/app-mode')
    expect(mod.resolveAppMode()).toBe('venue')
    expect(mod.isVenueAppMode()).toBe(true)
    expect(mod.isSignalAppMode()).toBe(false)
  })

  it('returns signal when VITE_APP_MODE=signal', async () => {
    vi.stubEnv('VITE_APP_MODE', 'signal')
    vi.resetModules()
    const mod = await import('@/lib/app-mode')
    expect(mod.resolveAppMode()).toBe('signal')
    expect(mod.isSignalAppMode()).toBe(true)
  })

  it('returns venue when VITE_APP_MODE=venue', async () => {
    vi.stubEnv('VITE_APP_MODE', 'venue')
    vi.resetModules()
    const mod = await import('@/lib/app-mode')
    expect(mod.resolveAppMode()).toBe('venue')
    expect(mod.isVenueAppMode()).toBe(true)
  })
})
