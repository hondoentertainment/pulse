import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Pulse } from '@/lib/types'
import { PulseData, hasSupabaseEnv } from '@/lib/data'
import { venueKeys } from './use-venues'

/** Query key factory for pulse-related queries. */
export const pulseKeys = {
  all: ['pulses'] as const,
  byVenue: (venueId: string) => ['pulses', { venueId }] as const,
}

function mapPulseToCreateInput(pulse: Pulse) {
  return {
    venueId: pulse.venueId,
    energyRating: pulse.energyRating,
    caption: pulse.caption,
    photos: pulse.photos,
    video: pulse.video,
    hashtags: pulse.hashtags,
    crewId: pulse.crewId,
    credibilityWeight: pulse.credibilityWeight,
    isPioneer: pulse.isPioneer,
  }
}

/**
 * Fetch pulses — all live pulses, or recent pulses for one venue when `venueId` is set.
 * Returns [] in mock-only mode (KV / mock state owns pulses there).
 */
export function usePulses(venueId?: string) {
  return useQuery<Pulse[], Error>({
    queryKey: venueId ? pulseKeys.byVenue(venueId) : pulseKeys.all,
    queryFn: async () => {
      if (!hasSupabaseEnv()) return []
      if (venueId) {
        return PulseData.listRecentPulsesAtVenue(venueId)
      }
      return PulseData.listLivePulses()
    },
  })
}

/**
 * Create a pulse via Supabase. In mock-only mode echoes the pulse back (local state owns persistence).
 */
export function useCreatePulse() {
  const queryClient = useQueryClient()

  return useMutation<Pulse, Error, Pulse>({
    mutationFn: async (pulse) => {
      if (!hasSupabaseEnv()) {
        return pulse
      }
      return PulseData.createPulse(mapPulseToCreateInput(pulse))
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
