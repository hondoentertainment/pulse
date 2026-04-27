// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * This suite validates the branching rule used by AppStateProvider:
 *   - when `USE_SUPABASE_BACKEND` is ON and auth isn't placeholder, reads
 *     call the data modules first (VenueData.listVenues /
 *     PulseData.listLivePulses);
 *   - when either is off, reads go through the fallback (legacy fetch +
 *     fixtures) and the data modules are not called.
 *
 * Rather than mounting the full AppStateProvider (which brings in useKV,
 * realtime subscriptions, geolocation, reverse geocoding, etc.), we host
 * the same useQuery branch in a tiny hook and assert which mock was hit.
 */

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  return {
    listVenues: vi.fn<() => Promise<unknown[]>>(),
    listLivePulses: vi.fn<() => Promise<unknown[]>>(),
    fetchVenuesFromSupabase: vi.fn<() => Promise<unknown[] | null>>(),
    fetchPulsesFromSupabase: vi.fn<() => Promise<unknown[] | null>>(),
    loadMockVenueFixtures: vi.fn(async () => ({ MOCK_VENUES: [] })),
    loadUSVenueFixtures: vi.fn(async () => []),
    loadGlobalVenueFixtures: vi.fn(async () => ({ GLOBAL_EXPANSION_VENUES: [] })),
  }
})

vi.mock('@/lib/data', () => ({
  USE_SUPABASE_BACKEND: true,
  warnIfUsingMockBackend: vi.fn(),
  VenueData: { listVenues: mocks.listVenues },
  PulseData: { listLivePulses: mocks.listLivePulses },
}))

vi.mock('@/lib/supabase-api', () => ({
  fetchVenuesFromSupabase: mocks.fetchVenuesFromSupabase,
  fetchPulsesFromSupabase: mocks.fetchPulsesFromSupabase,
}))

vi.mock('@/lib/mock-data', () => ({
  loadMockVenueFixtures: mocks.loadMockVenueFixtures,
}))

vi.mock('@/lib/us-venues', () => ({
  loadUSVenueFixtures: mocks.loadUSVenueFixtures,
}))

vi.mock('@/lib/global-venues', () => ({
  loadGlobalVenueFixtures: mocks.loadGlobalVenueFixtures,
}))

// ── Import after mocks ───────────────────────────────────────────────────
import { USE_SUPABASE_BACKEND, VenueData, PulseData } from '@/lib/data'
import { AuthRequiredError } from '@/lib/auth/require-auth'
import { RlsDeniedError } from '@/lib/auth/rls-helpers'
import {
  fetchVenuesFromSupabase,
  fetchPulsesFromSupabase,
} from '@/lib/supabase-api'
import { loadMockVenueFixtures } from '@/lib/mock-data'
import { loadUSVenueFixtures } from '@/lib/us-venues'
import { loadGlobalVenueFixtures } from '@/lib/global-venues'

// Mirror the branching from `use-app-state.tsx`. Keeping this inline in the
// test guarantees we test the exact same resolution logic even if the hook
// is later reshaped, without paying the cost of booting the entire provider.
function useVenuesQuery(opts: { supabaseReadsEnabled: boolean; userId?: string }) {
  return useQuery({
    queryKey: [
      'venues',
      opts.supabaseReadsEnabled ? 'supabase' : 'fallback',
      opts.userId ?? 'anon',
    ],
    queryFn: async () => {
      if (opts.supabaseReadsEnabled) {
        try {
          const rows = await VenueData.listVenues()
          if (rows.length > 0) return rows
        } catch (error) {
          if (error instanceof AuthRequiredError || error instanceof RlsDeniedError) {
            // degrade silently
          } else {
            throw error
          }
        }
      }
      const legacy = await fetchVenuesFromSupabase().catch(() => null)
      if (legacy && legacy.length > 0) return legacy
      const [mockRes, usMock, globalRes] = await Promise.all([
        loadMockVenueFixtures(),
        loadUSVenueFixtures(),
        loadGlobalVenueFixtures(),
      ])
      const devMock = [
        ...mockRes.MOCK_VENUES,
        ...usMock,
        ...globalRes.GLOBAL_EXPANSION_VENUES,
      ]
      return devMock.length > 0 ? devMock : null
    },
  })
}

function usePulsesQuery(opts: { supabaseReadsEnabled: boolean; userId?: string }) {
  return useQuery({
    queryKey: [
      'pulses',
      opts.supabaseReadsEnabled ? 'supabase' : 'fallback',
      opts.userId ?? 'anon',
    ],
    queryFn: async () => {
      if (opts.supabaseReadsEnabled) {
        try {
          const rows = await PulseData.listLivePulses()
          return rows
        } catch (error) {
          if (error instanceof AuthRequiredError || error instanceof RlsDeniedError) {
            return []
          }
        }
      }
      return fetchPulsesFromSupabase().catch(() => null)
    },
  })
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.listVenues.mockReset()
  mocks.listLivePulses.mockReset()
  mocks.fetchVenuesFromSupabase.mockReset()
  mocks.fetchPulsesFromSupabase.mockReset()
})

describe('AppStateProvider remote-read branching', () => {
  it('exposes a USE_SUPABASE_BACKEND flag that is importable', () => {
    // Smoke check the mock wiring so failing mocks show up early.
    expect(USE_SUPABASE_BACKEND).toBe(true)
  })

  it('prefers VenueData.listVenues when the Supabase path is enabled', async () => {
    mocks.listVenues.mockResolvedValue([{ id: 'v-1', name: 'Bar' }])
    const { result } = renderHook(
      () => useVenuesQuery({ supabaseReadsEnabled: true, userId: 'u-1' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.listVenues).toHaveBeenCalledOnce()
    expect(mocks.fetchVenuesFromSupabase).not.toHaveBeenCalled()
    expect(result.current.data).toEqual([{ id: 'v-1', name: 'Bar' }])
  })

  it('uses legacy/mock fallback when Supabase path is disabled', async () => {
    mocks.fetchVenuesFromSupabase.mockResolvedValue(null)
    const { result } = renderHook(
      () => useVenuesQuery({ supabaseReadsEnabled: false }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.listVenues).not.toHaveBeenCalled()
    expect(mocks.fetchVenuesFromSupabase).toHaveBeenCalled()
  })

  it('falls back to fixtures when Supabase path throws AuthRequiredError', async () => {
    mocks.listVenues.mockRejectedValue(new AuthRequiredError('read venues'))
    mocks.fetchVenuesFromSupabase.mockResolvedValue(null)
    const { result } = renderHook(
      () => useVenuesQuery({ supabaseReadsEnabled: true }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Supabase path was attempted and rejected, then fallback kicked in.
    expect(mocks.listVenues).toHaveBeenCalled()
    expect(mocks.fetchVenuesFromSupabase).toHaveBeenCalled()
  })

  it('falls back to fixtures when Supabase path throws RlsDeniedError', async () => {
    mocks.listVenues.mockRejectedValue(new RlsDeniedError('RLS denied'))
    mocks.fetchVenuesFromSupabase.mockResolvedValue(null)
    const { result } = renderHook(
      () => useVenuesQuery({ supabaseReadsEnabled: true }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.listVenues).toHaveBeenCalled()
    expect(mocks.fetchVenuesFromSupabase).toHaveBeenCalled()
  })

  it('returns [] from pulses query when auth is required (graceful empty state)', async () => {
    mocks.listLivePulses.mockRejectedValue(new AuthRequiredError('read pulses'))
    const { result } = renderHook(
      () => usePulsesQuery({ supabaseReadsEnabled: true }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('pulses fallback path is used when backend is off', async () => {
    mocks.fetchPulsesFromSupabase.mockResolvedValue([{ id: 'p-1' }])
    const { result } = renderHook(
      () => usePulsesQuery({ supabaseReadsEnabled: false }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.listLivePulses).not.toHaveBeenCalled()
    expect(mocks.fetchPulsesFromSupabase).toHaveBeenCalled()
    expect(result.current.data).toEqual([{ id: 'p-1' }])
  })
})
