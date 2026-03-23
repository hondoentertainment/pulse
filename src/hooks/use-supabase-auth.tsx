import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as AuthUser, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User as PulseUser } from '@/lib/types'

interface SupabaseAuthContextType {
  session: Session | null
  user: AuthUser | null
  profile: PulseUser | null
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined)

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<PulseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setIsLoading(false)
      }
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

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error)
      }
      
      if (data) {
        setProfile({
          id: data.id,
          username: data.username,
          profilePhoto: data.profile_photo_url,
          friends: data.friends || [],
          favoriteVenues: data.favorite_venues || [],
          followedVenues: data.followed_venues || [],
          createdAt: data.created_at,
          venueCheckInHistory: data.venue_check_in_history || {},
          favoriteCategories: data.favorite_categories || [],
          credibilityScore: data.credibility_score || 1.0,
          presenceSettings: data.presence_settings || { enabled: true, visibility: 'everyone', hideAtSensitiveVenues: false },
          postStreak: data.post_streak || 0,
          lastPostDate: data.last_post_date
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async () => {
    // For MVP prototyping without real emails, we will just use an anonymous sign-in or a 
    // mock sign in. Since Supabase allows Anonymous Sign-Ins in edge, we'll try that.
    // In production, this would be an OAuth or Magic Link sign-in.
    const { error } = await supabase.auth.signInAnonymously()
    if (error) console.error('Sign in error:', error)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out error:', error)
  }

  return (
    <SupabaseAuthContext.Provider value={{ session, user, profile, isLoading, signIn, signOut }}>
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
