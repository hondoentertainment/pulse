import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import type { Pulse } from '@/lib/types'
import { PulseData, hasSupabaseEnv, type PulsePage } from '@/lib/data'
import { assertWriteAllowed } from '@/lib/auth/require-auth'
import { fetchPulseListPage, fetchPulseDetail } from '@/lib/api-client'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { venueKeys } from './use-venues'
import { normalizePulse } from '@/lib/pulse-media'

/** Query key factory for pulse-related queries. */
export const pulseKeys = {
  all: ['pulses'] as const,
  byVenue: (venueId: string) => ['pulses', { venueId }] as const,
  detail: (pulseId: string) => ['pulses', 'detail', pulseId] as const,
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
 * Paginated live pulses (`useInfiniteQuery`). No-op pages when Supabase env is missing.
 * Uses `GET /api/pulses/list` when a session token exists (Wave 4); otherwise reads via `PulseData`.
 */
export function useLivePulsesInfinite(pageSize = 50) {
  const { session } = useSupabaseAuth()
  const accessToken = session?.access_token ?? null

  return useInfiniteQuery<PulsePage, Error>({
    queryKey: [...pulseKeys.all, 'infinite', 'live', pageSize, accessToken ? 'api' : 'direct'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!hasSupabaseEnv()) return { items: [], nextOffset: null }
      const offset = pageParam as number
      if (accessToken) {
        const result = await fetchPulseListPage({
          accessToken,
          limit: pageSize,
          offset,
        })
        if (result.ok) {
          const { pulses, hasMore, limit } = result.data
          return {
            items: (pulses as Pulse[]).map((pulse) => normalizePulse(pulse)),
            nextOffset: hasMore ? offset + limit : null,
          }
        }
      }
      return PulseData.listLivePulsesPaged(pageSize, offset)
    },
    getNextPageParam: (last) => last.nextOffset,
  })
}

/**
 * Paginated pulses for one venue.
 */
export function useVenuePulsesInfinite(venueId: string | undefined, pageSize = 50) {
  const { session } = useSupabaseAuth()
  const accessToken = session?.access_token ?? null

  return useInfiniteQuery<PulsePage, Error>({
    queryKey: venueId
      ? [...pulseKeys.byVenue(venueId), 'infinite', pageSize, accessToken ? 'api' : 'direct']
      : ['pulses', 'venue', 'disabled'],
    initialPageParam: 0,
    enabled: Boolean(venueId),
    queryFn: async ({ pageParam }) => {
      if (!venueId || !hasSupabaseEnv()) return { items: [], nextOffset: null }
      const offset = pageParam as number
      if (accessToken) {
        const result = await fetchPulseListPage({
          accessToken,
          venueId,
          limit: pageSize,
          offset,
        })
        if (result.ok) {
          const { pulses, hasMore, limit } = result.data
          return {
            items: (pulses as Pulse[]).map((pulse) => normalizePulse(pulse)),
            nextOffset: hasMore ? offset + limit : null,
          }
        }
      }
      return PulseData.listRecentPulsesAtVenuePaged(venueId, pageSize, offset)
    },
    getNextPageParam: (last) => last.nextOffset,
  })
}

/**
 * Fetch a single pulse by id from the API when authenticated; otherwise reads via `PulseData`.
 */
export function usePulse(pulseId: string | undefined) {
  const { session } = useSupabaseAuth()
  const accessToken = session?.access_token ?? null

  return useQuery<Pulse | null, Error>({
    queryKey: pulseId
      ? [...pulseKeys.detail(pulseId), accessToken ? 'api' : 'direct']
      : ['pulses', 'detail', 'disabled'],
    enabled: Boolean(pulseId),
    queryFn: async () => {
      if (!pulseId || !hasSupabaseEnv()) return null
      if (accessToken) {
        const result = await fetchPulseDetail(pulseId, { accessToken })
        if (result.ok) {
          return normalizePulse(result.data.pulse as Pulse)
        }
        if (result.status === 404) return null
      }
      return PulseData.getPulse(pulseId)
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
      await assertWriteAllowed('create a pulse')
      return PulseData.createPulse(mapPulseToCreateInput(pulse))
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...pulseKeys.all] })
      if (variables.venueId) {
        queryClient.invalidateQueries({ queryKey: pulseKeys.byVenue(variables.venueId) })
        queryClient.invalidateQueries({ queryKey: venueKeys.detail(variables.venueId) })
      }
    },
  })
}
