// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { User, Venue } from '@/lib/types'

const authState = vi.hoisted(() => ({
  session: null as { access_token: string } | null,
  isPlaceholder: false,
}))

const setters = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  message: vi.fn(),
}))

const venue: Venue = {
  id: 'venue-1',
  name: 'Test Bar',
  location: { lat: 47.6, lng: -122.3, address: '123 Pike St' },
  pulseScore: 50,
}

const currentUser: User = {
  id: 'guest-browse',
  username: 'guest',
  friends: [],
  createdAt: '1970-01-01T00:00:00.000Z',
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => setters.navigate,
  }
})

vi.mock('sonner', () => ({ toast }))

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => ({
    session: authState.session,
    isPlaceholder: authState.isPlaceholder,
    updateProfile: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-app-state', () => ({
  useAppState: () => ({
    venues: [venue],
    pulses: [],
    currentUser,
    userLocation: null,
    setActiveTab: vi.fn(),
    setSelectedVenue: vi.fn(),
    setPulses: vi.fn(),
    setVenues: vi.fn(),
    setNotifications: vi.fn(),
    setHashtags: vi.fn(),
    setStories: vi.fn(),
    setEvents: vi.fn(),
    setCrewCheckIns: vi.fn(),
    setPromotions: vi.fn(),
    setContentReports: vi.fn(),
    venueForPulse: venue,
    setVenueForPulse: vi.fn(),
    setCreateDialogOpen: vi.fn(),
    notificationSettings: {},
    crewCheckIns: [],
    crews: [],
  }),
}))

import { useAppHandlers } from '@/hooks/use-app-handlers'

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('handleSubmitPulse auth gate', () => {
  beforeEach(() => {
    authState.session = null
    authState.isPlaceholder = false
    setters.navigate.mockClear()
    toast.error.mockClear()
  })

  it('redirects guests to /auth instead of toast-only', async () => {
    const { result } = renderHook(() => useAppHandlers(), { wrapper })
    await result.current.handleSubmitPulse({
      energyRating: 'electric',
      caption: 'Floor packed',
      photos: [],
      kind: 'review',
    })
    expect(setters.navigate).toHaveBeenCalledWith('/auth')
    expect(toast.error).toHaveBeenCalled()
  })
})
