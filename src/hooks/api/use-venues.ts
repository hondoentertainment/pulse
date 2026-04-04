import { useQuery } from '@tanstack/react-query'
import type { Venue } from '@/lib/types'
import {
  isSupabaseConfigured,
  fetchVenues as fetchVenuesFromApi,
  fetchVenueById,
} from '@/lib/api-client'
import { MOCK_VENUES } from '@/lib/mock-data'

/** Query key factory for venue-related queries. */
export const venueKeys = {
  all: ['venues'] as const,
  detail: (id: string) => ['venues', id] as const,
}

/**
 * Fetch all venues.
 * Falls back to mock data when Supabase is not configured.
 */
export function useVenues() {
  return useQuery<Venue[], Error>({
    queryKey: venueKeys.all,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return MOCK_VENUES
      return fetchVenuesFromApi()
    },
  })
}

/**
 * Fetch a single venue by ID.
 * Falls back to mock data lookup when Supabase is not configured.
 */
export function useVenue(id: string | undefined) {
  return useQuery<Venue | undefined, Error>({
    queryKey: venueKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return undefined
      if (!isSupabaseConfigured()) {
        return MOCK_VENUES.find((v) => v.id === id)
      }
      return fetchVenueById(id)
    },
    enabled: Boolean(id),
  })
}
