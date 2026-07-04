import { useQuery } from '@tanstack/react-query'
import type { User, Venue } from '@/lib/types'
import type { Crew } from '@/lib/crew-mode'
import { FollowData, VenueData, hasSupabaseEnv } from '@/lib/data'
import { supabase } from '@/lib/supabase'
import { fetchProfilesByIds } from '@/lib/auth-profile'

/** Query key factory for social-related queries. */
export const socialKeys = {
  crews: (userId: string) => ['social', 'crews', userId] as const,
  friends: (userId: string) => ['social', 'friends', userId] as const,
  following: (userId: string) => ['social', 'following', userId] as const,
}

/**
 * Crews for a user — no Supabase crew module yet; returns [] when backend is on.
 */
export function useCrews(userId: string | undefined) {
  return useQuery<Crew[], Error>({
    queryKey: socialKeys.crews(userId ?? ''),
    queryFn: async () => {
      if (!userId) return []
      return []
    },
    enabled: Boolean(userId),
  })
}

/**
 * Friend profiles: `follows` rows (user targets) joined to `profiles`.
 */
export function useFriends(userId: string | undefined) {
  return useQuery<User[], Error>({
    queryKey: socialKeys.friends(userId ?? ''),
    queryFn: async () => {
      if (!userId) return []
      if (!hasSupabaseEnv()) return []

      const ids = await FollowData.listFollowedUsers(userId)
      if (ids.length === 0) return []

      return fetchProfilesByIds(supabase, ids)
    },
    enabled: Boolean(userId),
  })
}

/**
 * Followed venues: venue ids from `follows`, hydrated with `venues` rows.
 */
export function useFollowing(userId: string | undefined) {
  return useQuery<Venue[], Error>({
    queryKey: socialKeys.following(userId ?? ''),
    queryFn: async () => {
      if (!userId) return []
      if (!hasSupabaseEnv()) return []

      const venueIds = await FollowData.listFollowedVenues(userId)
      if (venueIds.length === 0) return []

      const venues = await Promise.all(venueIds.map((id) => VenueData.getVenue(id)))
      return venues.filter((v): v is Venue => v !== null)
    },
    enabled: Boolean(userId),
  })
}
