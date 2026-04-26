import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Pulse } from '@/lib/types'
import {
  isSupabaseConfigured,
  fetchPulses as fetchPulsesFromApi,
  createPulse as createPulseInApi,
} from '@/lib/api-client'
import { venueKeys } from './use-venues'

/** Query key factory for pulse-related queries. */
export const pulseKeys = {
  all: ['pulses'] as const,
  byVenue: (venueId: string) => ['pulses', { venueId }] as const,
}

/**
 * Fetch pulses, optionally filtered by venue.
 * Falls back to an empty array when Supabase is not configured (mock
 * pulses live in KV state managed by use-app-state, not in this layer).
 */
export function usePulses(venueId?: string) {
  return useQuery<Pulse[], Error>({
    queryKey: venueId ? pulseKeys.byVenue(venueId) : pulseKeys.all,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return []
      return fetchPulsesFromApi(venueId)
    },
  })
}

/**
 * Create a new pulse.
 * On success, invalidates both pulses and the relevant venue detail so
 * pulse scores refresh.
 */
export function useCreatePulse() {
  const queryClient = useQueryClient()

  return useMutation<Pulse, Error, Pulse>({
    mutationFn: async (pulse) => {
      if (!isSupabaseConfigured()) {
        // In mock mode just echo the pulse back; local state handles persistence.
        return pulse
      }
      return createPulseInApi(pulse)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pulseKeys.all })
      if (variables.venueId) {
        queryClient.invalidateQueries({ queryKey: pulseKeys.byVenue(variables.venueId) })
        queryClient.invalidateQueries({ queryKey: venueKeys.detail(variables.venueId) })
      }
    },
  })
}
