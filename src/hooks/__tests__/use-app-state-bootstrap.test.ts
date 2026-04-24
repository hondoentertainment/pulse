import { describe, expect, it, vi } from 'vitest'
import type { User, Venue } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

const { getCurrentUserFromProfile, getInitialCatalogState } = await import('../use-app-state')

describe('app state bootstrap helpers', () => {
  it('bridges the auth profile into app user state', () => {
    const profile: User = {
      id: 'user-1',
      username: 'nightowl',
      friends: [],
      favoriteVenues: [],
      followedVenues: [],
      createdAt: '2026-04-20T00:00:00.000Z',
    }

    expect(getCurrentUserFromProfile(profile)).toEqual(profile)
    expect(getCurrentUserFromProfile(null)).toBeUndefined()
  })

  it('keeps fallback catalog data available when Supabase is not configured', () => {
    const fallbackVenues: Venue[] = [
      {
        id: 'venue-1',
        name: 'Neon Room',
        location: { lat: 47.6, lng: -122.3, address: '123 Pike St' },
        pulseScore: 88,
      },
    ]

    const initialState = getInitialCatalogState(fallbackVenues)

    expect(initialState.venues).toEqual(fallbackVenues)
    expect(initialState.pulses).toEqual([])
  })
})
