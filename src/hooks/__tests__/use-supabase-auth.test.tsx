// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

const { supabaseMock } = vi.hoisted(() => {
  const supabaseMock = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithOAuth: async () => ({ error: null }),
      signInWithOtp: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
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

import { SupabaseAuthProvider, useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { hasPlaceholderCredentials } from '@/lib/supabase'

function Wrapper({ children }: { children: ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('hasPlaceholderCredentials', () => {
  it('returns true when mocked as unconfigured', () => {
    expect(hasPlaceholderCredentials()).toBe(true)
  })
})

describe('useSupabaseAuth — without Supabase config', () => {
  it('exposes an idle unauthenticated session', async () => {
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: Wrapper })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
  })
})

describe('useSupabaseAuth — context error', () => {
  it('throws when used outside provider', () => {
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
