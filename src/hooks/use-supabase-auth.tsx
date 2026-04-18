import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { User as AuthUser, Session, Provider } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { identify } from '@/lib/observability/analytics'
import type { User as PulseUser } from '@/lib/types'

/**
 * Returns true when the Supabase URL/key are still the built-in placeholders,
 * meaning no real Supabase project has been connected.
 */
export function hasPlaceholderCredentials(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return !url || !key || url.includes('placeholder') || key === 'placeholder-anon-key'
}

interface SupabaseAuthContextType {
  session: Session | null
  user: AuthUser | null
  profile: PulseUser | null
  isLoading: boolean
  isPlaceholder: boolean
  authError: string | null
  signInWithOAuth: (provider: Provider) => Promise<void>
  signInWithOtp: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined)

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const isPlaceholder = hasPlaceholderCredentials()

  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<PulseUser | null>(null)
  const [isLoading, setIsLoading] = useState(!isPlaceholder)
  const [authError, setAuthError] = useState<string | null>(null)

  // ── Bootstrap session ────────────────────────────────────
  useEffect(() => {
    if (isPlaceholder) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        identify(session.user.id, {
          email: session.user.email ?? undefined,
          createdAt: session.user.created_at,
        })
        ensureProfile(session.user)
      } else {
        identify(null)
        setIsLoading(false)
      }
    }).catch(() => {
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        identify(session.user.id, {
          email: session.user.email ?? undefined,
          createdAt: session.user.created_at,
        })
        ensureProfile(session.user)
      } else {
        identify(null)
        setProfile(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [isPlaceholder])

  // ── Profile helpers ──────────────────────────────────────
  const ensureProfile = async (authUser: AuthUser) => {
    try {
      setIsLoading(true)

      // Try to fetch an existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet — auto-create on first sign-in
        const newProfile = buildProfileFromAuth(authUser)
        const { data: inserted, error: insertErr } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select('*')
          .single()

        if (insertErr) {
          console.error('Error creating profile:', insertErr)
          // Still set a local-only profile so the app is usable
          setProfile(mapRowToUser(newProfile))
        } else if (inserted) {
          setProfile(mapRowToUser(inserted))
        }
      } else if (error) {
        console.error('Error fetching profile:', error)
      } else if (data) {
        setProfile(mapRowToUser(data))
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Auth methods ─────────────────────────────────────────
  const signInWithOAuth = useCallback(async (provider: Provider) => {
    setAuthError(null)
    if (isPlaceholder) {
      setAuthError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      console.error('OAuth sign-in error:', error)
      setAuthError(error.message)
    }
  }, [isPlaceholder])

  const signInWithOtp = useCallback(async (email: string) => {
    setAuthError(null)
    if (isPlaceholder) {
      setAuthError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.')
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      console.error('OTP sign-in error:', error)
      setAuthError(error.message)
    }
  }, [isPlaceholder])

  const signOut = useCallback(async () => {
    setAuthError(null)
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out error:', error)
  }, [])

  return (
    <SupabaseAuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        isPlaceholder,
        authError,
        signInWithOAuth,
        signInWithOtp,
        signOut,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  )
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext)
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider')
  }
  return context
}

// ── Helpers ──────────────────────────────────────────────────

function buildProfileFromAuth(authUser: AuthUser): Record<string, unknown> {
  const meta = authUser.user_metadata ?? {}
  const username =
    meta.preferred_username ||
    meta.user_name ||
    meta.full_name?.replace(/\s+/g, '_').toLowerCase() ||
    authUser.email?.split('@')[0] ||
    `user_${authUser.id.slice(0, 8)}`

  return {
    id: authUser.id,
    username,
    profile_photo_url: meta.avatar_url || meta.picture || null,
    friends: [],
    favorite_venues: [],
    followed_venues: [],
    created_at: new Date().toISOString(),
    venue_check_in_history: {},
    favorite_categories: [],
    credibility_score: 1.0,
    presence_settings: { enabled: true, visibility: 'everyone', hideAtSensitiveVenues: false },
    post_streak: 0,
    last_post_date: null,
  }
}

function mapRowToUser(row: Record<string, unknown>): PulseUser {
  return {
    id: row.id as string,
    username: row.username as string,
    profilePhoto: (row.profile_photo_url as string) || undefined,
    friends: (row.friends as string[]) || [],
    favoriteVenues: (row.favorite_venues as string[]) || [],
    followedVenues: (row.followed_venues as string[]) || [],
    createdAt: row.created_at as string,
    venueCheckInHistory: (row.venue_check_in_history as Record<string, number>) || {},
    favoriteCategories: (row.favorite_categories as string[]) || [],
    credibilityScore: (row.credibility_score as number) || 1.0,
    presenceSettings: (row.presence_settings as PulseUser['presenceSettings']) || {
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: false,
    },
    postStreak: (row.post_streak as number) || 0,
    lastPostDate: (row.last_post_date as string) || undefined,
  }
}
