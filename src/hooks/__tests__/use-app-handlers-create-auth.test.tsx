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
  setCreateDialogOpen: vi.fn(),
  setVenueForPulse: vi.fn(),
  navigate: vi.fn(),
}))

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
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

vi.mock('sonner', () => ({
  toast,
}))

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
    setVenueForPulse: setters.setVenueForPulse,
    setCreateDialogOpen: setters.setCreateDialogOpen,
    notificationSettings: {},
    crewCheckIns: [],
    crews: [],
  }),
}))

import { useAppHandlers } from '@/hooks/use-app-handlers'

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('handleCreatePulse auth gate', () => {
  beforeEach(() => {
    authState.session = null
    authState.isPlaceholder = false
    setters.setCreateDialogOpen.mockClear()
    setters.setVenueForPulse.mockClear()
    setters.navigate.mockClear()
    toast.error.mockClear()
  })

  it('redirects guests to /auth and does not open the composer', () => {
    const { result } = renderHook(() => useAppHandlers(), { wrapper })
    result.current.handleCreatePulse('venue-1')

    expect(setters.navigate).toHaveBeenCalledWith('/auth')
    expect(setters.setCreateDialogOpen).toHaveBeenCalledWith(false)
    expect(setters.setVenueForPulse).toHaveBeenCalledWith(null)
    expect(toast.error).toHaveBeenCalledWith('Sign in required', {
      description: 'Sign in to create a Pulse.',
    })
  })

  it('opens the composer when a session exists', () => {
    authState.session = { access_token: 'real-session' }
    const { result } = renderHook(() => useAppHandlers(), { wrapper })
    result.current.handleCreatePulse('venue-1')

    expect(setters.navigate).not.toHaveBeenCalled()
    expect(setters.setVenueForPulse).toHaveBeenCalledWith(venue)
    expect(setters.setCreateDialogOpen).toHaveBeenCalledWith(true)
  })

  it('opens the composer in placeholder/demo mode without a session', () => {
    authState.isPlaceholder = true
    const { result } = renderHook(() => useAppHandlers(), { wrapper })
    result.current.handleCreatePulse('venue-1')

    expect(setters.navigate).not.toHaveBeenCalled()
    expect(setters.setCreateDialogOpen).toHaveBeenCalledWith(true)
  })
})
