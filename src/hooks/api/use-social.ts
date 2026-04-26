import { useQuery } from '@tanstack/react-query'
import type { User, Venue } from '@/lib/types'
import type { Crew } from '@/lib/crew-mode'
import {
  isSupabaseConfigured,
  fetchCrews as fetchCrewsFromApi,
  fetchFriends as fetchFriendsFromApi,
  fetchFollowing as fetchFollowingFromApi,
} from '@/lib/api-client'

/** Query key factory for social-related queries. */
export const socialKeys = {
  crews: (userId: string) => ['social', 'crews', userId] as const,
  friends: (userId: string) => ['social', 'friends', userId] as const,
  following: (userId: string) => ['social', 'following', userId] as const,
}

/**
 * Fetch crews for a given user.
 * Returns an empty array in mock mode (crews live in KV state).
 */
export function useCrews(userId: string | undefined) {
  return useQuery<Crew[], Error>({
    queryKey: socialKeys.crews(userId ?? ''),
    queryFn: async () => {
      if (!userId) return []
      if (!isSupabaseConfigured()) return []
      return fetchCrewsFromApi(userId)
    },
    enabled: Boolean(userId),
  })
}

/**
 * Fetch friend profiles for a given user.
 * Returns an empty array in mock mode.
 */
export function useFriends(userId: string | undefined) {
  return useQuery<User[], Error>({
    queryKey: socialKeys.friends(userId ?? ''),
    queryFn: async () => {
      if (!userId) return []
      if (!isSupabaseConfigured()) return []
      return fetchFriendsFromApi(userId)
    },
    enabled: Boolean(userId),
  })
}

/**
 * Fetch venues that a user follows.
 * Returns an empty array in mock mode.
 */
export function useFollowing(userId: string | undefined) {
  return useQuery<Venue[], Error>({
    queryKey: socialKeys.following(userId ?? ''),
    queryFn: async () => {
      if (!userId) return []
      if (!isSupabaseConfigured()) return []
      return fetchFollowingFromApi(userId)
    },
    enabled: Boolean(userId),
  })
}
