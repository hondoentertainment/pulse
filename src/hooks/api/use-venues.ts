import { useQuery } from '@tanstack/react-query'
import type { Venue } from '@/lib/types'
import { VenueData, hasSupabaseEnv } from '@/lib/data'
import { MOCK_VENUES } from '@/lib/mock-data'

/** Query key factory for venue-related queries. */
export const venueKeys = {
  all: ['venues'] as const,
  detail: (id: string) => ['venues', id] as const,
}

/**
 * Fetch all venues from Supabase when env is configured; otherwise mock fixtures.
 */
export function useVenues() {
  return useQuery<Venue[], Error>({
    queryKey: venueKeys.all,
    queryFn: async () => {
      if (!hasSupabaseEnv()) return MOCK_VENUES
      return VenueData.listVenues()
    },
  })
}

/**
 * Fetch a single venue by ID from Supabase when env is configured; otherwise mock lookup.
 */
export function useVenue(id: string | undefined) {
  return useQuery<Venue | undefined, Error>({
    queryKey: venueKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return undefined
      if (!hasSupabaseEnv()) {
        return MOCK_VENUES.find((v) => v.id === id)
      }
      const venue = await VenueData.getVenue(id)
      return venue ?? undefined
    },
    enabled: Boolean(id),
  })
}
