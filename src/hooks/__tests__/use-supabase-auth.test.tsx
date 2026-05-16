// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// ── Supabase client mock (hoisted so the vi.mock factory can see it) ──
// The hook also imports `hasSupabaseConfig` and `isE2EAuthBypassEnabled`
// from `@/lib/supabase`; both must be present on the mock or the provider
// throws at render time. With `hasSupabaseConfig: false` the provider runs
// its placeholder branch — no real Supabase calls are made.
const { supabaseMock } = vi.hoisted(() => {
  const supabaseMock = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInAnonymously: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }
  return { supabaseMock }
})

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
  hasSupabaseConfig: false,
  isE2EAuthBypassEnabled: false,
  isVisualPreviewEnabled: false,
  hasPlaceholderCredentials: () => true,
}))

// ── Import after mocks ─────────────────────────────────────────
import { SupabaseAuthProvider, useSupabaseAuth } from '@/hooks/use-supabase-auth'

function Wrapper({ children }: { children: ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

describe('useSupabaseAuth — placeholder mode (no Supabase credentials)', () => {
  it('exposes a null session and finishes loading', () => {
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
  })

  it('exposes the auth API surface', () => {
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    expect(typeof result.current.signIn).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
    expect(typeof result.current.updateProfile).toBe('function')
  })

  it('signIn activates a local preview session', async () => {
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.signIn()
    })
    expect(result.current.session).not.toBeNull()
    expect(result.current.user).not.toBeNull()
    expect(result.current.profile).not.toBeNull()
  })

  it('signOut resolves and clears the session', async () => {
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.signIn()
    })
    await act(async () => {
      await expect(result.current.signOut()).resolves.toBeUndefined()
    })
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
  })
})

describe('useSupabaseAuth — context error', () => {
  it('throws when used outside provider', () => {
    // Suppress the expected React error log for the thrown render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useSupabaseAuth())).toThrow(
      /must be used within a SupabaseAuthProvider/,
    )
    spy.mockRestore()
  })
})

describe('SupabaseAuthProvider — renders children', () => {
  it('renders wrapped children', () => {
    const { getByText } = render(
      <SupabaseAuthProvider>
        <p>hello auth</p>
      </SupabaseAuthProvider>,
    )
    expect(getByText('hello auth')).toBeInTheDocument()
  })
})
