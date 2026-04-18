// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Venue, User, Pulse, PulseWithUser } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    button: ({
      children,
      ...props
    }: HTMLAttributes<HTMLButtonElement> & { whileHover?: unknown; whileTap?: unknown }) => {
      const { whileHover: _whileHover, whileTap: _whileTap, ...rest } = props as Record<string, unknown>
      return <button {...(rest as HTMLAttributes<HTMLButtonElement>)}>{children}</button>
    },
  },
  useReducedMotion: () => false,
}))

const { MockIcon } = vi.hoisted(() => {
  const MockIcon = () => null
  return { MockIcon }
})

vi.mock('@phosphor-icons/react', () => ({
  Star: MockIcon,
  Megaphone: MockIcon,
  Scales: MockIcon,
  Lightning: MockIcon,
  MapPin: MockIcon,
  MusicNote: MockIcon,
  TrendUp: MockIcon,
  Beer: MockIcon,
}))

vi.mock('@/lib/venue-trending', () => ({
  getTrendingSections: () => [],
}))

vi.mock('@/lib/venue-recommendations', () => ({
  getRecommendations: () => [],
}))

vi.mock('@/lib/time-contextual-scoring', () => ({
  getPeakCategories: () => [],
}))

vi.mock('@/lib/promoted-discoveries', () => ({
  isPromotionActive: () => false,
}))

vi.mock('@/components/Favorites', () => ({
  Favorites: () => <div data-testid="favorites" />,
}))

vi.mock('@/components/TrendingSections', () => ({
  TrendingSections: () => <div data-testid="trending-sections" />,
}))

vi.mock('@/components/MySpotsFeed', () => ({
  MySpotsFeed: () => <div data-testid="my-spots-feed" />,
}))

vi.mock('@/components/RecommendationsSection', () => ({
  RecommendationsSection: () => <div data-testid="recommendations" />,
}))

vi.mock('@/components/PulseScore', () => ({
  PulseScore: () => <div data-testid="pulse-score" />,
}))

vi.mock('@/components/LiveActivityFeed', () => ({
  LiveActivityFeed: () => <div data-testid="live-activity-feed">No activity nearby</div>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: () => [null, vi.fn()],
}))

import { TrendingTab } from '../TrendingTab'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 47.6, lng: -122.3, address: '123 Main St' },
    pulseScore: 72,
    category: 'Bar',
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'testuser',
    friends: [],
    createdAt: '2024-01-01',
    ...overrides,
  }
}

const defaultProps = {
  venues: [makeVenue()],
  pulses: [] as Pulse[],
  pulsesWithUsers: [] as PulseWithUser[],
  favoriteVenues: [],
  followedVenues: [],
  userLocation: null,
  unitSystem: 'imperial' as const,
  currentUser: makeUser(),
  allUsers: [makeUser()],
  trendingSubTab: 'trending' as const,
  onSubTabChange: vi.fn(),
  onVenueClick: vi.fn(),
  onToggleFavorite: vi.fn(),
  onToggleFollow: vi.fn(),
  onReaction: vi.fn(),
  isFavorite: vi.fn().mockReturnValue(false),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrendingTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the Trending sub-tab button', () => {
    render(<TrendingTab {...defaultProps} />)
    expect(screen.getByText('Trending')).toBeTruthy()
  })

  it('renders Live Activity section header in trending sub-tab', () => {
    render(<TrendingTab {...defaultProps} />)
    expect(screen.getByText('Live Activity')).toBeTruthy()
  })

  it('renders LiveActivityFeed in the trending sub-tab', () => {
    render(<TrendingTab {...defaultProps} />)
    expect(screen.getByTestId('live-activity-feed')).toBeTruthy()
  })

  it('LiveActivityFeed appears after recommendations in the DOM', () => {
    render(<TrendingTab {...defaultProps} />)
    const recommendations = screen.getByTestId('recommendations')
    const liveHeader = screen.getByText('Live Activity')

    expect(recommendations).toBeTruthy()
    expect(liveHeader).toBeTruthy()
    // recommendations should come before live activity header
    const position = recommendations.compareDocumentPosition(liveHeader)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not render LiveActivityFeed when my-spots sub-tab is active', () => {
    render(<TrendingTab {...defaultProps} trendingSubTab="my-spots" />)
    expect(screen.queryByText('Live Activity')).toBeNull()
    expect(screen.getByTestId('my-spots-feed')).toBeTruthy()
  })

  it('renders TrendingSections in the trending sub-tab', () => {
    render(<TrendingTab {...defaultProps} />)
    expect(screen.getByTestId('trending-sections')).toBeTruthy()
  })
})
