// @vitest-environment jsdom

import type { HTMLAttributes, ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Hoist mock functions ---
const { mockUseStreakRewards, mockUseNeighborhoodWalkthrough, mockUseOfflineCache } = vi.hoisted(() => ({
  mockUseStreakRewards: vi.fn(),
  mockUseNeighborhoodWalkthrough: vi.fn(),
  mockUseOfflineCache: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
    circle: (props: Record<string, unknown>) => <circle {...props} />,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}))

vi.mock('@phosphor-icons/react', () => {
  const Stub = () => null
  return {
    Star: Stub, MapPin: Stub, Gear: Stub, Storefront: Stub, UserPlus: Stub,
    Link: Stub, Check: Stub, Lightning: Stub, Fire: Stub, CaretDown: Stub,
    CaretUp: Stub, Warning: Stub, CaretLeft: Stub, MapTrifold: Stub,
    Crown: Stub, TrendUp: Stub, NavigationArrow: Stub, Plus: Stub,
    Clock: Stub, Trophy: Stub, Wine: Stub, Beer: Stub, MusicNote: Stub,
    ForkKnife: Stub, Play: Stub, X: Stub,
  }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@github/spark/hooks', () => ({ useKV: () => [null, vi.fn()] }))

vi.mock('@/hooks/use-streak-rewards', () => ({
  useStreakRewards: (...args: unknown[]) => mockUseStreakRewards(...args),
}))
vi.mock('@/hooks/use-neighborhood-walkthrough', () => ({
  useNeighborhoodWalkthrough: (...args: unknown[]) => mockUseNeighborhoodWalkthrough(...args),
}))
vi.mock('@/hooks/use-offline-cache', () => ({
  useOfflineCache: (...args: unknown[]) => mockUseOfflineCache(...args),
}))

vi.mock('@/components/NeighborhoodWalkthrough', () => ({
  NeighborhoodWalkthrough: (props: any) => (
    <div data-testid="neighborhood-walkthrough">
      <span>Walkthrough: {props.neighborhood}</span>
      {props.route && <span>Route loaded</span>}
      <button onClick={props.onStart}>Start Route</button>
      <button onClick={props.onEnd}>End Walkthrough</button>
    </div>
  ),
}))

vi.mock('@/components/StreakCounter', () => ({
  StreakCounter: (props: any) => (
    <button data-testid="streak-counter" onClick={() => props.onExpand?.(props.streak)}>
      Streak: {props.streak?.currentCount ?? 0}
    </button>
  ),
}))

vi.mock('@/components/StreakDashboard', () => ({
  StreakDashboard: (props: any) => (
    <div data-testid="streak-dashboard">
      <span>Total XP: {props.totalXP}</span>
      <button onClick={props.onBack}>Back</button>
    </div>
  ),
}))

vi.mock('@/components/OfflineIndicator', () => ({
  OfflineIndicator: (props: any) => (
    <div data-testid="offline-indicator">
      {!props.isOnline && <div data-testid="offline-banner">You are offline</div>}
      {props.isOnline && props.syncProgress && (
        <div data-testid="sync-progress">Syncing {props.syncProgress.synced} of {props.syncProgress.total} queued actions</div>
      )}
    </div>
  ),
}))

vi.mock('@/components/PulseCard', () => ({ PulseCard: () => <div data-testid="pulse-card" /> }))
vi.mock('@/components/PulseScore', () => ({ PulseScore: () => <div data-testid="pulse-score" /> }))
vi.mock('@/components/Settings', () => ({ Settings: () => <div data-testid="settings" /> }))
vi.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }))
vi.mock('@/components/CreatorProfileBadge', () => ({ CreatorProfileBadge: () => <span data-testid="creator-badge" /> }))
vi.mock('@/lib/social-graph', () => ({ createFriendInviteLink: () => ({ url: 'https://test.com/invite' }) }))
vi.mock('@/lib/sharing', () => ({ createReferralInvite: () => ({ inviteCode: 'TEST123' }) }))
vi.mock('@/lib/creator-economy', () => ({ getCreatorTierProgress: () => ({ currentTier: null, progress: 50 }) }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => <div data-testid="app-header" /> }))
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => <div data-testid="bottom-nav" /> }))
vi.mock('@/components/CreatePulseDialog', () => ({ CreatePulseDialog: () => <div data-testid="create-pulse-dialog" /> }))

vi.mock('@/lib/neighborhood-scores', () => ({
  getNeighborhoodLeaderboard: () => [
    { neighborhoodId: 'n-seattle', name: 'Seattle', city: 'Seattle', score: 85, activeVenueCount: 3, totalVenues: 5, hottest: true },
  ],
  getHottestNeighborhood: () => ({
    neighborhoodId: 'n-seattle', name: 'Seattle', city: 'Seattle', score: 85, activeVenueCount: 3, totalVenues: 5, hottest: true,
  }),
  assignVenueToNeighborhood: vi.fn(),
}))

import type { User, Venue } from '@/lib/types'
import type { Streak } from '@/lib/streak-rewards'
import { ProfileTab } from '../ProfileTab'
import { NeighborhoodView } from '../NeighborhoodView'
import { AppShell } from '../AppShell'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1', username: 'testuser', profilePhoto: '', friends: [],
    favoriteVenues: [], followedVenues: [], createdAt: '2024-01-01T00:00:00Z', ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1', name: 'Test Bar',
    location: { lat: 47.6, lng: -122.3, address: '123 Main St' },
    city: 'Seattle', state: 'WA', pulseScore: 75, category: 'bar', ...overrides,
  }
}

function makeStreak(overrides: Partial<Streak> = {}): Streak {
  return {
    userId: 'user-1', type: 'weekly_checkin', currentCount: 5, longestCount: 5,
    lastActivity: new Date().toISOString(), isActive: true,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), ...overrides,
  }
}

describe('ProfileTab - Streak integration', () => {
  beforeEach(() => {
    mockUseStreakRewards.mockReturnValue({
      allStreaks: [makeStreak()], activeStreaks: [makeStreak()], atRiskStreaks: [],
      totalXP: 1200, currentMultiplier: 2, recentMilestones: [], leaderboard: () => [],
    })
  })

  it('renders streak section with StreakCounter widgets', () => {
    render(
      <ProfileTab currentUser={makeUser()} pulses={[]} pulsesWithUsers={[]} favoriteVenues={[]}
        onVenueClick={vi.fn()} onReaction={vi.fn()} onOpenSocialPulseDashboard={vi.fn()} />
    )
    expect(screen.getByTestId('streak-section')).toBeTruthy()
    expect(screen.getByText('Streaks')).toBeTruthy()
    expect(screen.getByTestId('streak-counters')).toBeTruthy()
  })

  it('toggles StreakDashboard visibility', () => {
    render(
      <ProfileTab currentUser={makeUser()} pulses={[]} pulsesWithUsers={[]} favoriteVenues={[]}
        onVenueClick={vi.fn()} onReaction={vi.fn()} onOpenSocialPulseDashboard={vi.fn()} />
    )
    expect(screen.getByText('View Streaks')).toBeTruthy()
    fireEvent.click(screen.getByTestId('streak-toggle'))
    expect(screen.getByText('Hide')).toBeTruthy()
  })

  it('shows StreakDashboard when expanded', async () => {
    render(
      <ProfileTab currentUser={makeUser()} pulses={[]} pulsesWithUsers={[]} favoriteVenues={[]}
        onVenueClick={vi.fn()} onReaction={vi.fn()} onOpenSocialPulseDashboard={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('streak-toggle'))
    expect(await screen.findByTestId('streak-dashboard')).toBeTruthy()
    expect(screen.getByText('Total XP: 1200')).toBeTruthy()
  })

  it('shows XP multiplier badge when multiplier > 1', () => {
    render(
      <ProfileTab currentUser={makeUser()} pulses={[]} pulsesWithUsers={[]} favoriteVenues={[]}
        onVenueClick={vi.fn()} onReaction={vi.fn()} onOpenSocialPulseDashboard={vi.fn()} />
    )
    expect(screen.getByText('2x XP')).toBeTruthy()
  })
})

describe('NeighborhoodView - Walkthrough integration', () => {
  const mockGenerateRoute = vi.fn()
  const mockEndWalkthrough = vi.fn()

  beforeEach(() => {
    mockUseNeighborhoodWalkthrough.mockReturnValue({
      generateRoute: mockGenerateRoute, activeRoute: null, currentStopIndex: 0,
      advanceToNext: vi.fn(), isActive: false, isCompleted: false,
      startWalkthrough: vi.fn(), endWalkthrough: mockEndWalkthrough,
      estimatedCompletion: null, availableThemes: ['hottest', 'cocktail-crawl'],
    })
    mockGenerateRoute.mockReset()
    mockEndWalkthrough.mockReset()
  })

  it('renders Bar Crawl button on leaderboard entries', () => {
    render(
      <NeighborhoodView venues={[makeVenue()]} pulses={[]} onBack={vi.fn()}
        onVenueClick={vi.fn()} userLocation={{ lat: 47.6, lng: -122.3 }} />
    )
    expect(screen.getByText('Bar Crawl')).toBeTruthy()
  })

  it('opens walkthrough section when Bar Crawl is clicked', () => {
    render(
      <NeighborhoodView venues={[makeVenue()]} pulses={[]} onBack={vi.fn()}
        onVenueClick={vi.fn()} userLocation={{ lat: 47.6, lng: -122.3 }} />
    )
    fireEvent.click(screen.getByText('Bar Crawl'))
    expect(screen.getByTestId('walkthrough-section')).toBeTruthy()
    expect(mockGenerateRoute).toHaveBeenCalled()
  })

  it('closes walkthrough section when Close is clicked', () => {
    render(
      <NeighborhoodView venues={[makeVenue()]} pulses={[]} onBack={vi.fn()}
        onVenueClick={vi.fn()} userLocation={{ lat: 47.6, lng: -122.3 }} />
    )
    fireEvent.click(screen.getByText('Bar Crawl'))
    expect(screen.getByTestId('walkthrough-section')).toBeTruthy()
    fireEvent.click(screen.getByTestId('walkthrough-close'))
    expect(screen.queryByTestId('walkthrough-section')).toBeNull()
  })
})

describe('AppShell - OfflineIndicator integration', () => {
  const makeMockState = (overrides = {}) => ({
    locationName: 'Seattle', isTracking: false, realtimeLocation: null,
    locationPermissionDenied: false, currentTime: new Date(),
    activeTab: 'trending' as const, createDialogOpen: false,
    setCreateDialogOpen: vi.fn(), venueForPulse: null,
    unreadNotificationCount: 0, currentUser: makeUser(), ...overrides,
  })
  const makeMockHandlers = () => ({
    handleTabChange: vi.fn(), handleSubmitPulse: vi.fn(), handleCreatePulse: vi.fn(),
  })

  beforeEach(() => {
    mockUseOfflineCache.mockReturnValue({
      isOnline: true, cachedVenues: [], lastSyncTime: Date.now(),
      cacheStats: { hitRate: 0.75, totalEntries: 10, usedBytes: 1024, oldestEntry: null },
      queuedActions: [], syncProgress: null, forcePrefetch: vi.fn(),
      clearCache: vi.fn(), queueAction: vi.fn(),
    })
  })

  it('renders OfflineIndicator without visible banner when online', () => {
    render(
      <AppShell state={makeMockState() as any} handlers={makeMockHandlers() as any} sortedVenues={[makeVenue()]}>
        <div>App content</div>
      </AppShell>
    )
    expect(screen.getByTestId('offline-indicator')).toBeTruthy()
    expect(screen.queryByTestId('offline-banner')).toBeNull()
    expect(screen.getByText('App content')).toBeTruthy()
  })

  it('shows offline banner when offline', () => {
    mockUseOfflineCache.mockReturnValue({
      isOnline: false, cachedVenues: [], lastSyncTime: Date.now() - 5 * 60 * 1000,
      cacheStats: { hitRate: 0.75, totalEntries: 10, usedBytes: 1024, oldestEntry: null },
      queuedActions: [], syncProgress: null, forcePrefetch: vi.fn(),
      clearCache: vi.fn(), queueAction: vi.fn(),
    })
    render(
      <AppShell state={makeMockState() as any} handlers={makeMockHandlers() as any} sortedVenues={[makeVenue()]}>
        <div>App content</div>
      </AppShell>
    )
    expect(screen.getByTestId('offline-banner')).toBeTruthy()
  })

  it('shows sync progress when syncing', () => {
    mockUseOfflineCache.mockReturnValue({
      isOnline: true, cachedVenues: [], lastSyncTime: Date.now(),
      cacheStats: { hitRate: 0.75, totalEntries: 10, usedBytes: 1024, oldestEntry: null },
      queuedActions: [], syncProgress: { total: 5, synced: 2 }, forcePrefetch: vi.fn(),
      clearCache: vi.fn(), queueAction: vi.fn(),
    })
    render(
      <AppShell state={makeMockState() as any} handlers={makeMockHandlers() as any} sortedVenues={[makeVenue()]}>
        <div>App content</div>
      </AppShell>
    )
    expect(screen.getByTestId('sync-progress')).toBeTruthy()
    expect(screen.getByText(/Syncing 2 of 5/i)).toBeTruthy()
  })
})
