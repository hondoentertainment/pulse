// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { signInWithOtp, signInWithOAuth } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp,
      signInWithOAuth,
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  },
  hasSupabaseConfig: true,
  hasPlaceholderCredentials: () => false,
  isE2EAuthBypassEnabled: false,
}))

import { SupabaseAuthProvider, useSupabaseAuth } from '@/hooks/use-supabase-auth'

const PROD_ORIGIN = 'https://pulse-chi-nine.vercel.app'

function Wrapper({ children }: { children: ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

function stubOrigin(origin: string, pathname = '/auth') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      origin,
      pathname,
      href: `${origin}${pathname}`,
    },
  })
}

describe('useSupabaseAuth redirects', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    signInWithOAuth.mockReset()
    signInWithOtp.mockResolvedValue({ data: {}, error: null })
    signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    stubOrigin(PROD_ORIGIN, '/auth')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes emailRedirectTo from the mocked window origin on magic link', async () => {
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.signInWithOtp('guest@example.com')
    })

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'guest@example.com',
      options: { emailRedirectTo: PROD_ORIGIN },
    })
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).not.toMatch(
      /localhost/,
    )
  })

  it('passes OAuth redirectTo from the mocked window origin', async () => {
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.signInWithOAuth('google')
    })

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: PROD_ORIGIN },
    })
    expect(signInWithOAuth.mock.calls[0][0].options.redirectTo).not.toMatch(
      /localhost/,
    )
  })

  it('uses a preview origin mock instead of baking in localhost', async () => {
    stubOrigin('https://preview-123.vercel.app', '/')
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.signInWithOtp('preview@example.com')
    })

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'preview@example.com',
      options: { emailRedirectTo: 'https://preview-123.vercel.app' },
    })
  })
})
