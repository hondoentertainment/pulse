// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { authState, supabaseMock } = vi.hoisted(() => {
  const authState = { session: null as unknown, error: null as { message: string } | null }
  const supabaseMock = {
    auth: {
      getSession: async () => ({ data: { session: authState.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInAnonymously: async () => ({ error: authState.error }),
      signInWithOAuth: async () => ({ error: authState.error }),
      signInWithOtp: async () => ({ error: authState.error }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { code: 'PGRST116' } }) }) }),
    }),
  }
  return { authState, supabaseMock }
})

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    supabase: supabaseMock,
    hasSupabaseConfig: false,
    hasPlaceholderCredentials: () => true,
    isE2EAuthBypassEnabled: false,
  }
})

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
  trackError: vi.fn(),
}))

import App from '@/App'

describe('App', () => {
  beforeEach(() => {
    authState.session = null
    authState.error = null
    localStorage.clear()
  })

  it('mounts a global Sonner toaster on the login branch', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Your daily state, in 10 seconds/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('region', { name: /Notifications/i })).toBeInTheDocument()
  })
})
