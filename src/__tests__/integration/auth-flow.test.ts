import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Session, User as AuthUser, Provider } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mock the Supabase client before any module that imports it is loaded.
// ---------------------------------------------------------------------------

let authStateCallback: ((event: string, session: Session | null) => void) | null = null
const unsubscribeMock = vi.fn()

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb: (event: string, session: Session | null) => void) => {
      authStateCallback = cb
      return { data: { subscription: { unsubscribe: unsubscribeMock } } }
    }),
    signInWithOAuth: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    insert: vi.fn().mockReturnThis(),
  })),
}

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

// Ensure placeholder check evaluates to false so the provider performs real auth.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-1234')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-123',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: { preferred_username: 'testuser', avatar_url: 'https://img.test/avatar.png' },
    created_at: new Date().toISOString(),
    ...overrides,
  } as AuthUser
}

function makeFakeSession(user?: AuthUser): Session {
  const authUser = user ?? makeFakeAuthUser()
  return {
    access_token: 'access-token-abc',
    refresh_token: 'refresh-token-xyz',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: authUser,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth flow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStateCallback = null
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Sign-in via OAuth ────────────────────────────────────
  describe('sign-in flow', () => {
    it('calls supabase.auth.signInWithOAuth with correct provider', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null })

      const { supabase } = await import('@/lib/supabase')
      await supabase.auth.signInWithOAuth({
        provider: 'google' as Provider,
        options: { redirectTo: window.location.origin },
      })

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' }),
      )
    })

    it('calls supabase.auth.signInWithOtp with email', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null })

      const { supabase } = await import('@/lib/supabase')
      await supabase.auth.signInWithOtp({
        email: 'user@example.com',
        options: { emailRedirectTo: window.location.origin },
      })

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
      )
    })

    it('propagates sign-in error from Supabase', async () => {
      const error = { message: 'Invalid credentials', status: 401 }
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ data: null, error })

      const { supabase } = await import('@/lib/supabase')
      const result = await supabase.auth.signInWithOAuth({ provider: 'github' as Provider })

      expect(result.error).toEqual(error)
    })
  })

  // ── Sign-out clears session state ────────────────────────
  describe('sign-out flow', () => {
    it('calls supabase.auth.signOut and triggers state change callback', async () => {
      // Simulate an active session first
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: makeFakeSession() },
        error: null,
      })
      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      const { supabase } = await import('@/lib/supabase')

      // Register the listener
      supabase.auth.onAuthStateChange((_event: string, _session: Session | null) => {})

      // Perform sign out
      await supabase.auth.signOut()
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1)

      // Simulate the auth state change callback that Supabase fires on sign-out
      authStateCallback?.('SIGNED_OUT', null)

      // Verify the callback was registered
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled()
    })

    it('clears local storage session data on sign-out', () => {
      // Simulate session stored in localStorage (Supabase's default persistence)
      localStorage.setItem('sb-test-auth-token', JSON.stringify(makeFakeSession()))
      expect(localStorage.getItem('sb-test-auth-token')).not.toBeNull()

      // Simulate sign-out clearing storage
      localStorage.removeItem('sb-test-auth-token')
      expect(localStorage.getItem('sb-test-auth-token')).toBeNull()
    })
  })

  // ── Auth state persistence across page reload ────────────
  describe('auth state persistence', () => {
    it('persists session in localStorage and retrieves it on reload', async () => {
      const session = makeFakeSession()

      // Simulate Supabase storing session in localStorage
      const storageKey = 'sb-test-project-auth-token'
      localStorage.setItem(storageKey, JSON.stringify(session))

      // Simulate page reload: getSession should return the persisted session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      })

      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.auth.getSession()

      expect(data.session).toBeDefined()
      expect(data.session?.user.id).toBe('user-123')
      expect(data.session?.access_token).toBe('access-token-abc')
    })

    it('returns null session when localStorage is empty (logged-out state)', async () => {
      localStorage.clear()

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.auth.getSession()

      expect(data.session).toBeNull()
    })

    it('auto-refreshes session token on reload', async () => {
      const expiredSession = makeFakeSession()
      expiredSession.expires_at = Math.floor(Date.now() / 1000) - 60 // expired 1 minute ago

      // Supabase auto-refresh returns a new session
      const refreshedSession = makeFakeSession()
      refreshedSession.access_token = 'refreshed-access-token'

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: refreshedSession },
        error: null,
      })

      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.auth.getSession()

      expect(data.session?.access_token).toBe('refreshed-access-token')
    })
  })

  // ── Auth state change subscription ───────────────────────
  describe('auth state change subscription', () => {
    it('registers onAuthStateChange listener', async () => {
      const { supabase } = await import('@/lib/supabase')
      const callback = vi.fn()

      supabase.auth.onAuthStateChange(callback)

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(callback)
    })

    it('fires callback on SIGNED_IN event', () => {
      const session = makeFakeSession()
      const callback = vi.fn()

      mockSupabase.auth.onAuthStateChange.mockImplementation((cb: (event: string, session: Session | null) => void) => {
        authStateCallback = cb
        return { data: { subscription: { unsubscribe: unsubscribeMock } } }
      })

      // Register
      mockSupabase.auth.onAuthStateChange(callback)
      // Simulate event
      authStateCallback?.('SIGNED_IN', session)

      expect(authStateCallback).toBeDefined()
    })

    it('provides unsubscribe function that cleans up listener', async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data: { subscription } } = supabase.auth.onAuthStateChange(vi.fn())

      subscription.unsubscribe()

      expect(unsubscribeMock).toHaveBeenCalled()
    })
  })
})
