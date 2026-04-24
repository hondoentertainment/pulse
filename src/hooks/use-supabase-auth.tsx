import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as AuthUser, Session } from '@supabase/supabase-js'
import { hasSupabaseConfig, isE2EAuthBypassEnabled, supabase } from '@/lib/supabase'
import type { User as PulseUser } from '@/lib/types'
import { createFallbackProfile, fetchOrCreateProfile } from '@/lib/auth-profile'

interface SupabaseAuthContextType {
  session: Session | null
  user: AuthUser | null
  profile: PulseUser | null
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<PulseUser>) => Promise<void>
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined)

function createBypassUser(): AuthUser {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    app_metadata: { provider: 'e2e' },
    user_metadata: {
      user_name: 'nightowl',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl',
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'nightowl@pulse.test',
  } as AuthUser
}

function createBypassSession(user: AuthUser): Session {
  return {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    expires_in: 60 * 60,
    token_type: 'bearer',
    user,
  } as Session
}

function createPreviewAuthState() {
  const previewUser = createBypassUser()
  return {
    user: previewUser,
    session: createBypassSession(previewUser),
    profile: createFallbackProfile(previewUser),
  }
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<PulseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const activatePreviewSession = () => {
    const preview = createPreviewAuthState()
    setSession(preview.session)
    setUser(preview.user)
    setProfile(preview.profile)
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    if (isE2EAuthBypassEnabled) {
      const bypassUser = createBypassUser()
      const bypassSession = createBypassSession(bypassUser)
      setSession(bypassSession)
      setUser(bypassUser)
      setProfile(createFallbackProfile(bypassUser))
      setIsLoading(false)
      return
    }

    if (!hasSupabaseConfig) {
      setSession(null)
      setUser(null)
      setProfile(null)
      setIsLoading(false)
      return
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setIsLoading(false)
      }
    }).catch((error) => {
      console.error('Error loading auth session:', error)
      if (isMounted) setIsLoading(false)
    })

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      setIsLoading(true)
      const { data: authData } = await supabase.auth.getUser()
      const authUser = authData.user

      if (!authUser || authUser.id !== userId) {
        setProfile(null)
        return
      }

      const nextProfile = await fetchOrCreateProfile(supabase, authUser)
      setProfile(nextProfile)
    } catch (error) {
      console.error('Error fetching profile:', error)
      const { data: authData } = await supabase.auth.getUser()
      const authUser = authData.user
      if (authUser && authUser.id === userId) {
        setProfile(createFallbackProfile(authUser))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async () => {
    if (!hasSupabaseConfig) {
      activatePreviewSession()
      return
    }

    // For MVP prototyping without real emails, we will just use an anonymous sign-in or a 
    // mock sign in. Since Supabase allows Anonymous Sign-Ins in edge, we'll try that.
    // In production, this would be an OAuth or Magic Link sign-in.
    const { error } = await supabase.auth.signInAnonymously()
    if (error) console.error('Sign in error:', error)
  }

  const signOut = async () => {
    if (!hasSupabaseConfig) {
      setSession(null)
      setUser(null)
      setProfile(null)
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out error:', error)
  }

  const updateProfile = async (updates: Partial<PulseUser>) => {
    if (!user || !profile) return
    const newProfile = { ...profile, ...updates }
    setProfile(newProfile)

    if (!hasSupabaseConfig || isE2EAuthBypassEnabled) {
      return
    }
    
    const dbUpdates = {
      username: newProfile.username,
      profile_photo_url: newProfile.profilePhoto,
      friends: newProfile.friends,
      favorite_venues: newProfile.favoriteVenues,
      followed_venues: newProfile.followedVenues,
      favorite_categories: newProfile.favoriteCategories,
      credibility_score: newProfile.credibilityScore,
      presence_settings: newProfile.presenceSettings,
      venue_check_in_history: newProfile.venueCheckInHistory,
      post_streak: newProfile.postStreak,
      last_post_date: newProfile.lastPostDate,
    }
    
    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id)
      
    if (error) {
      console.error('Error updating profile in Supabase:', error)
      // Revert optimistic update
      fetchProfile(user.id)
    }
  }

  return (
    <SupabaseAuthContext.Provider value={{ session, user, profile, isLoading, signIn, signOut, updateProfile }}>
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
