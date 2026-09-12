// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User, Venue } from '@/lib/types'

const authState = vi.hoisted(() => ({
  session: null as { access_token: string } | null,
  isPlaceholder: false,
  isLoading: false,
}))

const appState = vi.hoisted(() => {
  const venue: Venue = {
    id: 'venue-1',
    name: 'Test Bar',
    location: { lat: 47.6, lng: -122.3, address: '123 Pike St' },
    pulseScore: 50,
  }
  const guest: User = {
    id: 'guest-browse',
    username: 'guest',
    friends: [],
    favoriteVenues: [],
    followedVenues: [],
    createdAt: '1970-01-01T00:00:00.000Z',
  }
  return {
    venue,
    guest,
    createDialogOpen: false,
    setCreateDialogOpen: vi.fn((open: boolean) => {
      appState.createDialogOpen = open
    }),
    setVenueForPulse: vi.fn(),
  }
})

vi.mock('framer-motion', () => {
  const strip = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {}
    const blocked = new Set([
      'initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap',
      'whileInView', 'whileDrag', 'drag', 'dragConstraints', 'dragElastic',
      'layout', 'layoutId', 'variants', 'custom', 'onAnimationComplete',
    ])
    for (const [key, value] of Object.entries(props)) {
      if (blocked.has(key)) continue
      if (typeof value === 'function' && !key.startsWith('on')) continue
      filtered[key] = value
    }
    return filtered
  }
  return {
    motion: {
      div: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
        <div {...strip(props)}>{children}</div>
      ),
      button: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
        <button {...strip(props)}>{children}</button>
      ),
      span: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
        <span {...strip(props)}>{children}</span>
      ),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => ({
    session: authState.session,
    user: null,
    profile: null,
    isLoading: authState.isLoading,
    isPlaceholder: authState.isPlaceholder,
    authError: null,
    signIn: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-app-state', () => ({
  useAppState: () => ({
    hasCompletedOnboarding: true,
    setHasCompletedOnboarding: vi.fn(),
    venues: [appState.venue],
    pulses: [],
    currentUser: appState.guest,
    showAdminDashboard: false,
    setShowAdminDashboard: vi.fn(),
    socialDashboardEnabled: false,
    createDialogOpen: appState.createDialogOpen,
    setCreateDialogOpen: appState.setCreateDialogOpen,
    venueForPulse: null,
    setVenueForPulse: appState.setVenueForPulse,
    locationName: 'Seattle',
    isTracking: false,
    realtimeLocation: null,
    userLocation: null,
    locationPermissionDenied: false,
    queuedPulseCount: 0,
    sortedVenues: [appState.venue],
    selectedMarketKey: 'seattle',
    setSelectedMarketKey: vi.fn(),
    availableMarkets: [],
    unreadNotificationCount: 0,
    setCurrentUser: vi.fn(),
    storyViewerOpen: false,
    storyViewerStories: [],
    setStoryViewerOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setSubPage: vi.fn(),
  }),
}))

vi.mock('@/components/MainTabRouter', () => ({
  MainTabRouter: () => <div data-testid="map-browse">Map and venues</div>,
}))

vi.mock('@/components/SubPageRouter', () => ({
  SubPageRouter: () => <div>Sub page</div>,
}))

vi.mock('@/components/VenueRoute', () => ({
  VenueRoute: () => <div>Venue</div>,
}))

vi.mock('@/components/VenueInboxRoute', () => ({
  VenueInboxRoute: () => <div>Inbox</div>,
}))

vi.mock('@/components/CreatePulseDialog', () => ({
  CreatePulseDialog: () => <div data-testid="create-pulse-dialog">Create Pulse dialog</div>,
}))

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

import { AppRoutes } from '@/AppRoutes'
import { DISCOVERY_AUTH_GATE_COPY } from '@/lib/guest-discovery'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('guest map discovery vs auth-gated create', () => {
  beforeEach(() => {
    authState.session = null
    authState.isPlaceholder = false
    authState.isLoading = false
    appState.createDialogOpen = false
    appState.setCreateDialogOpen.mockClear()
    appState.setVenueForPulse.mockClear()
  })

  it('lets an onboarded guest reach map + venues instead of the discovery AuthGate', async () => {
    renderAt('/')

    expect(await screen.findByTestId('map-browse')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /Primary/i })).toBeInTheDocument()
    expect(screen.getByTestId('tab-Map')).toBeInTheDocument()
    expect(screen.queryByText(DISCOVERY_AUTH_GATE_COPY)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue with Google/i })).not.toBeInTheDocument()
  })

  it('keeps Follow / write /auth on AuthGate even in placeholder mode', async () => {
    authState.isPlaceholder = true
    renderAt('/auth')
    expect(await screen.findByRole('button', { name: /Continue with Google/i })).toBeInTheDocument()
    expect(screen.queryByTestId('map-browse')).not.toBeInTheDocument()
  })

  it('sends a guest to /auth when they tap Create Pulse and does not open the composer', async () => {
    renderAt('/')

    fireEvent.click(await screen.findByRole('button', { name: /Create Pulse/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument()
    })
    expect(screen.queryByTestId('map-browse')).not.toBeInTheDocument()
    expect(appState.setCreateDialogOpen).toHaveBeenCalledWith(false)
    expect(screen.queryByText(DISCOVERY_AUTH_GATE_COPY)).not.toBeInTheDocument()
  })

  it('opens Create Pulse for a signed-in user without showing AuthGate', async () => {
    authState.session = { access_token: 'real-session' }
    renderAt('/')

    fireEvent.click(await screen.findByRole('button', { name: /Create Pulse/i }))

    await waitFor(() => {
      expect(appState.setCreateDialogOpen).toHaveBeenCalledWith(true)
    })
    expect(screen.getByTestId('map-browse')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue with Google/i })).not.toBeInTheDocument()
  })
})
