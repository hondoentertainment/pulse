import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The module caches `USE_SUPABASE_BACKEND` at import time. We use
// `vi.resetModules()` + `vi.stubEnv()` to re-evaluate per test.

async function importConfig() {
  // Fresh module instance so `resolveBackend()` sees the latest stubbed env.
  vi.resetModules()
  return import('../data/config')
}

describe('USE_SUPABASE_BACKEND resolution', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('resolves to false when both env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { USE_SUPABASE_BACKEND, hasSupabaseEnv, resolveBackend } = await importConfig()
    expect(hasSupabaseEnv()).toBe(false)
    expect(resolveBackend()).toBe(false)
    expect(USE_SUPABASE_BACKEND).toBe(false)
  })

  it('resolves to false when only VITE_SUPABASE_URL is set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://my-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { hasSupabaseEnv, resolveBackend } = await importConfig()
    expect(hasSupabaseEnv()).toBe(false)
    expect(resolveBackend()).toBe(false)
  })

  it('resolves to false when only VITE_SUPABASE_ANON_KEY is set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'some-real-anon-key')
    const { hasSupabaseEnv, resolveBackend } = await importConfig()
    expect(hasSupabaseEnv()).toBe(false)
    expect(resolveBackend()).toBe(false)
  })

  it('resolves to false when both env vars are placeholders', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://placeholder-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'placeholder-anon-key')
    const { hasSupabaseEnv, resolveBackend } = await importConfig()
    expect(hasSupabaseEnv()).toBe(false)
    expect(resolveBackend()).toBe(false)
  })

  it('resolves to true when both env vars are set and look real', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefgh.supabase.co')
    vi.stubEnv(
      'VITE_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real-looking-key',
    )
    vi.stubEnv('VITE_USE_SUPABASE_BACKEND', '')
    const { USE_SUPABASE_BACKEND, hasSupabaseEnv, resolveBackend } = await importConfig()
    expect(hasSupabaseEnv()).toBe(true)
    expect(resolveBackend()).toBe(true)
    expect(USE_SUPABASE_BACKEND).toBe(true)
  })

  it('honours VITE_USE_SUPABASE_BACKEND=false even with real creds', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefgh.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'real-looking-key-xyz')
    vi.stubEnv('VITE_USE_SUPABASE_BACKEND', 'false')
    const { resolveBackend } = await importConfig()
    expect(resolveBackend()).toBe(false)
  })

  it('ignores VITE_USE_SUPABASE_BACKEND=true when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('VITE_USE_SUPABASE_BACKEND', 'true')
    const { resolveBackend } = await importConfig()
    // Never force-on without credentials.
    expect(resolveBackend()).toBe(false)
  })

  it.each(['0', 'false', 'no', 'off', 'FALSE', 'Off'])(
    'disables backend when VITE_USE_SUPABASE_BACKEND=%s',
    async (value) => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefgh.supabase.co')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'real-key-abc')
      vi.stubEnv('VITE_USE_SUPABASE_BACKEND', value)
      const { resolveBackend } = await importConfig()
      expect(resolveBackend()).toBe(false)
    },
  )
})

describe('warnIfUsingMockBackend', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('does not log when backend is enabled', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefgh.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'real-key-xyz')
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { warnIfUsingMockBackend } = await importConfig()
    warnIfUsingMockBackend()
    expect(infoSpy).not.toHaveBeenCalled()
    infoSpy.mockRestore()
  })

  it('is guarded by a once-per-module-load latch', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { warnIfUsingMockBackend } = await importConfig()
    warnIfUsingMockBackend()
    warnIfUsingMockBackend()
    // Log at most once per module instance (DEV may/may not be truthy in
    // the vitest env; either way the second call must not produce a log).
    expect(infoSpy.mock.calls.length).toBeLessThanOrEqual(1)
    infoSpy.mockRestore()
  })
})
