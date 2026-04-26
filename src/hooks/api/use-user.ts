import { useQuery } from '@tanstack/react-query'
import type { User } from '@/lib/types'
import {
  isSupabaseConfigured,
  fetchCurrentUser as fetchCurrentUserFromApi,
  fetchUserProfile as fetchUserProfileFromApi,
} from '@/lib/api-client'

/** Default mock user matching the one seeded in use-app-state. */
const MOCK_CURRENT_USER: User = {
  id: 'user-1',
  username: 'kyle',
  profilePhoto:
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop',
  friends: ['user-2', 'user-3', 'user-4'],
  favoriteVenues: [],
  followedVenues: [],
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  venueCheckInHistory: {},
  credibilityScore: 1.0,
  presenceSettings: {
    enabled: true,
    visibility: 'everyone',
    hideAtSensitiveVenues: true,
  },
}

/** Mock users (same as ALL_USERS in use-app-state). */
const MOCK_USERS: User[] = [
  MOCK_CURRENT_USER,
  { id: 'user-2', username: 'sarah_j', profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-3', username: 'mike_v', profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-4', username: 'alex_k', profilePhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-5', username: 'jess_m', profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
  { id: 'user-6', username: 'tom_b', profilePhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
]

/** Query key factory for user-related queries. */
export const userKeys = {
  current: ['user', 'current'] as const,
  profile: (id: string) => ['user', id] as const,
}

/**
 * Fetch the currently authenticated user.
 * Falls back to the default mock user when Supabase is not configured.
 */
export function useCurrentUser() {
  return useQuery<User, Error>({
    queryKey: userKeys.current,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return MOCK_CURRENT_USER
      return fetchCurrentUserFromApi()
    },
  })
}

/**
 * Fetch a user profile by ID.
 * Falls back to mock user lookup when Supabase is not configured.
 */
export function useUserProfile(id: string | undefined) {
  return useQuery<User | undefined, Error>({
    queryKey: userKeys.profile(id ?? ''),
    queryFn: async () => {
      if (!id) return undefined
      if (!isSupabaseConfigured()) {
        return MOCK_USERS.find((u) => u.id === id)
      }
      return fetchUserProfileFromApi(id)
    },
    enabled: Boolean(id),
  })
}
