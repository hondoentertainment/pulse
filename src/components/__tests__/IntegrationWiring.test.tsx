// @vitest-environment jsdom

/**
 * Integration wiring tests.
 *
 * These tests verify that new features are correctly wired into
 * ProfileTab, NeighborhoodView, and AppShell by checking that the
 * relevant imports, hooks, and rendered elements are present.
 */
import type { HTMLAttributes, ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
}))

vi.mock('@phosphor-icons/react', () => new Proxy({}, { get: () => () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@github/spark/hooks', () => ({ useKV: () => [null, vi.fn()] }))

vi.mock('@/hooks/use-streak-rewards', () => ({ useStreakRewards: (...a: any[]) => mockUseStreakRewards(...a) }))
vi.mock('@/hooks/use-neighborhood-walkthrough', () => ({ useNeighborhoodWalkthrough: (...a: any[]) => mockUseNeighborhoodWalkthrough(...a) }))
vi.mock('@/hooks/use-offline-cache', () => ({ useOfflineCache: (...a: any[]) => mockUseOfflineCache(...a) }))

// Mock all sub-components that could pull in more deps
vi.mock('@/components/StreakCounter', () => ({ StreakCounter: (p: any) => <button data-testid="streak-counter" onClick={() => p.onExpand?.(p.streak)}>S:{p.streak?.currentCount}</button> }))
vi.mock('@/components/StreakDashboard', () => ({ StreakDashboard: (p: any) => <div data-testid="streak-dashboard">XP:{p.totalXP}<button onClick={p.onBack}>Back</button></div> }))
vi.mock('@/components/NeighborhoodWalkthrough', () => ({ NeighborhoodWalkthrough: (p: any) => <div data-testid="neighborhood-walkthrough">{p.neighborhood}<button onClick={p.onEnd}>End</button></div> }))
vi.mock('@/components/OfflineIndicator', () => ({
  OfflineIndicator: (p: any) => <div data-testid="offline-indicator">{!p.isOnline && <div data-testid="offline-banner">offline</div>}{p.isOnline && p.syncProgress && <div data-testid="sync-progress">Syncing {p.syncProgress.synced} of {p.syncProgress.total}</div>}</div>
}))
vi.mock('@/components/PulseCard', () => ({ PulseCard: () => null }))
vi.mock('@/components/PulseScore', () => ({ PulseScore: () => null }))
vi.mock('@/components/Settings', () => ({ Settings: () => null }))
vi.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }))
vi.mock('@/components/CreatorProfileBadge', () => ({ CreatorProfileBadge: () => null }))
vi.mock('@/lib/social-graph', () => ({ createFriendInviteLink: () => ({ url: 'x' }) }))
vi.mock('@/lib/sharing', () => ({ createReferralInvite: () => ({ inviteCode: 'X' }) }))
vi.mock('@/lib/creator-economy', () => ({ getCreatorTierProgress: () => ({ currentTier: null, progress: 50 }) }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => <div data-testid="app-header" /> }))
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => <div data-testid="bottom-nav" /> }))
vi.mock('@/components/CreatePulseDialog', () => ({ CreatePulseDialog: () => null }))
vi.mock('@/lib/neighborhood-scores', () => ({
  getNeighborhoodLeaderboard: () => [{ neighborhoodId: 'n-seattle', name: 'Seattle', city: 'Seattle', score: 85, activeVenueCount: 3, totalVenues: 5, hottest: true }],
  getHottestNeighborhood: () => ({ neighborhoodId: 'n-seattle', name: 'Seattle', city: 'Seattle', score: 85, activeVenueCount: 3, totalVenues: 5, hottest: true }),
  assignVenueToNeighborhood: vi.fn(),
}))

// --- Imports (must come after mocks) ---
import { ProfileTab } from '../ProfileTab'
import { NeighborhoodView } from '../NeighborhoodView'
import { AppShell } from '../AppShell'

const user = { id: 'u1', username: 'test', profilePhoto: '', friends: [], favoriteVenues: [], followedVenues: [], createdAt: '2024-01-01' } as any
const venue = { id: 'v1', name: 'Test Bar', location: { lat: 47.6, lng: -122.3, address: '123 Main' }, city: 'Seattle', state: 'WA', pulseScore: 75, category: 'bar' } as any
const streak = { userId: 'u1', type: 'weekly_checkin' as const, currentCount: 5, longestCount: 5, lastActivity: '', isActive: true, expiresAt: new Date(Date.now()+86400000).toISOString() }

describe('ProfileTab - Streak wiring', () => {
  beforeEach(() => {
    mockUseStreakRewards.mockReturnValue({
      allStreaks: [streak], activeStreaks: [streak], atRiskStreaks: [],
      totalXP: 1200, currentMultiplier: 2, recentMilestones: [], leaderboard: () => [],
    })
  })

  it('renders streak section with counters', () => {
    render(<ProfileTab currentUser={user} pulses={[]} pulsesWithUsers={[]} favoriteVenues={[]}
      onVenueClick={vi.fn()} onReaction={vi.fn()} onOpenSocialPulseDashboard={vi.fn()} />)
    expect(screen.getByTestId('streak-section')).toBeTruthy()
    expect(screen.getByTestId('streak-counters')).toBeTruthy()
  })

  it('shows StreakDashboard when toggled', () => {
    render(<ProfileTab currentUser={user} pulses={[]} pulsesWithUsers={[]} favoriteVenues={[]}
      onVenueClick={vi.fn()} onReaction={vi.fn()} onOpenSocialPulseDashboard={vi.fn()} />)
    fireEvent.click(screen.getByTestId('streak-toggle'))
    expect(screen.getByTestId('streak-dashboard')).toBeTruthy()
  })

  it('shows multiplier badge', () => {
    render(<ProfileTab currentUser={user} pulses={[]} pulsesWithUsers={[]} favoriteVenues={[]}
      onVenueClick={vi.fn()} onReaction={vi.fn()} onOpenSocialPulseDashboard={vi.fn()} />)
    expect(screen.getByText('2x XP')).toBeTruthy()
  })
})

describe('NeighborhoodView - Walkthrough wiring', () => {
  const genRoute = vi.fn()
  const endWalk = vi.fn()
  beforeEach(() => {
    mockUseNeighborhoodWalkthrough.mockReturnValue({
      generateRoute: genRoute, activeRoute: null, currentStopIndex: 0,
      advanceToNext: vi.fn(), isActive: false, isCompleted: false,
      startWalkthrough: vi.fn(), endWalkthrough: endWalk,
      estimatedCompletion: null, availableThemes: ['hottest'],
    })
    genRoute.mockReset()
    endWalk.mockReset()
  })

  it('shows Bar Crawl button', () => {
    render(<NeighborhoodView venues={[venue]} pulses={[]} onBack={vi.fn()} onVenueClick={vi.fn()} userLocation={{ lat: 47.6, lng: -122.3 }} />)
    expect(screen.getByText('Bar Crawl')).toBeTruthy()
  })

  it('opens walkthrough on Bar Crawl click', () => {
    render(<NeighborhoodView venues={[venue]} pulses={[]} onBack={vi.fn()} onVenueClick={vi.fn()} userLocation={{ lat: 47.6, lng: -122.3 }} />)
    fireEvent.click(screen.getByText('Bar Crawl'))
    expect(screen.getByTestId('walkthrough-section')).toBeTruthy()
    expect(genRoute).toHaveBeenCalled()
  })

  it('closes walkthrough on Close click', () => {
    render(<NeighborhoodView venues={[venue]} pulses={[]} onBack={vi.fn()} onVenueClick={vi.fn()} userLocation={{ lat: 47.6, lng: -122.3 }} />)
    fireEvent.click(screen.getByText('Bar Crawl'))
    fireEvent.click(screen.getByTestId('walkthrough-close'))
    expect(screen.queryByTestId('walkthrough-section')).toBeNull()
  })
})

describe('AppShell - OfflineIndicator wiring', () => {
  const state = (o = {}) => ({ locationName: 'Seattle', isTracking: false, realtimeLocation: null, locationPermissionDenied: false, currentTime: new Date(), activeTab: 'trending' as const, createDialogOpen: false, setCreateDialogOpen: vi.fn(), venueForPulse: null, unreadNotificationCount: 0, currentUser: user, ...o })
  const handlers = () => ({ handleTabChange: vi.fn(), handleSubmitPulse: vi.fn(), handleCreatePulse: vi.fn() })

  beforeEach(() => {
    mockUseOfflineCache.mockReturnValue({
      isOnline: true, cachedVenues: [], lastSyncTime: Date.now(),
      cacheStats: { hitRate: 0.75, totalEntries: 10, usedBytes: 1024, oldestEntry: null },
      queuedActions: [], syncProgress: null, forcePrefetch: vi.fn(), clearCache: vi.fn(), queueAction: vi.fn(),
    })
  })

  it('renders indicator, no banner when online', () => {
    render(<AppShell state={state() as any} handlers={handlers() as any} sortedVenues={[venue]}><div>content</div></AppShell>)
    expect(screen.getByTestId('offline-indicator')).toBeTruthy()
    expect(screen.queryByTestId('offline-banner')).toBeNull()
  })

  it('shows banner when offline', () => {
    mockUseOfflineCache.mockReturnValue({
      isOnline: false, cachedVenues: [], lastSyncTime: Date.now(),
      cacheStats: { hitRate: 0, totalEntries: 0, usedBytes: 0, oldestEntry: null },
      queuedActions: [], syncProgress: null, forcePrefetch: vi.fn(), clearCache: vi.fn(), queueAction: vi.fn(),
    })
    render(<AppShell state={state() as any} handlers={handlers() as any} sortedVenues={[venue]}><div>content</div></AppShell>)
    expect(screen.getByTestId('offline-banner')).toBeTruthy()
  })

  it('shows sync progress', () => {
    mockUseOfflineCache.mockReturnValue({
      isOnline: true, cachedVenues: [], lastSyncTime: Date.now(),
      cacheStats: { hitRate: 0, totalEntries: 0, usedBytes: 0, oldestEntry: null },
      queuedActions: [], syncProgress: { total: 5, synced: 2 }, forcePrefetch: vi.fn(), clearCache: vi.fn(), queueAction: vi.fn(),
    })
    render(<AppShell state={state() as any} handlers={handlers() as any} sortedVenues={[venue]}><div>content</div></AppShell>)
    expect(screen.getByTestId('sync-progress')).toBeTruthy()
  })
})
