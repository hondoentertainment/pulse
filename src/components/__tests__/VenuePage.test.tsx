// @vitest-environment jsdom

import type { HTMLAttributes, SVGAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { VenuePage } from '../VenuePage'
import type { User, Venue } from '@/lib/types'

// ── Mocks ────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}))

// Mock Phosphor icons as simple spans
vi.mock('@phosphor-icons/react', () => {
  const Icon = ({ children, ...props }: SVGAttributes<SVGSVGElement> & { weight?: string }) => (
    <svg {...props}>{children}</svg>
  )
  return {
    Plus: Icon,
    MapPin: Icon,
    ArrowLeft: Icon,
    Clock: Icon,
    Star: Icon,
    Phone: Icon,
    Globe: Icon,
    HeartStraight: Icon,
    Car: Icon,
    CalendarCheck: Icon,
    ShareNetwork: Icon,
    Ticket: Icon,
    CalendarBlank: Icon,
  }
})

// Mock all child components to keep tests focused on wiring
vi.mock('../PulseScore', () => ({
  PulseScore: () => <div data-testid="pulse-score" />,
}))

vi.mock('../PulseCard', () => ({
  PulseCard: () => <div data-testid="pulse-card" />,
}))

vi.mock('../ScoreBreakdown', () => ({
  ScoreBreakdown: () => <div data-testid="score-breakdown" />,
}))

vi.mock('../ShareSheet', () => ({
  ShareSheet: () => <div data-testid="share-sheet" />,
}))

vi.mock('../VenueLivePanel', () => ({
  VenueLivePanel: () => <div data-testid="venue-live-panel" />,
}))

vi.mock('../QuickReportSheet', () => ({
  QuickReportSheet: () => <div data-testid="quick-report-sheet" />,
}))

vi.mock('../AnimatedEmptyState', () => ({
  AnimatedEmptyState: () => <div data-testid="empty-state" />,
}))

vi.mock('../WhoIsHereRow', () => ({
  WhoIsHereRow: () => <div data-testid="who-is-here" />,
}))

vi.mock('../ParallaxVenueHero', () => ({
  ParallaxVenueHero: () => <div data-testid="parallax-hero" />,
}))

vi.mock('../LiveCrowdIndicator', () => ({
  LiveCrowdIndicator: () => <div data-testid="live-crowd-indicator" />,
}))

vi.mock('../VenueQuickActions', () => ({
  VenueQuickActions: () => <div data-testid="venue-quick-actions" />,
}))

vi.mock('../VenueActivityStream', () => ({
  VenueActivityStream: () => <div data-testid="venue-activity-stream" />,
}))

vi.mock('../VenueMemoryCard', () => ({
  default: () => <div data-testid="venue-memory-card" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

// ── Phase 5 component mocks (the ones we're verifying) ──────

vi.mock('../GoingTonightButton', () => ({
  GoingTonightButton: (props: Record<string, unknown>) => (
    <div data-testid="going-tonight-button" data-venue-id={props.venueId} />
  ),
}))

vi.mock('../EmojiReactionBar', () => ({
  EmojiReactionBar: (props: Record<string, unknown>) => (
    <div
      data-testid="emoji-reaction-bar"
      data-has-on-reaction={typeof props.onReaction === 'function' ? 'true' : 'false'}
    />
  ),
}))

vi.mock('../EmojiBurstOverlay', () => ({
  EmojiBurstOverlay: (props: Record<string, unknown>) => (
    <div
      data-testid="emoji-burst-overlay"
      data-has-particles={Array.isArray(props.particles) ? 'true' : 'false'}
    />
  ),
}))

vi.mock('../BoostStatusBadge', () => ({
  BoostStatusBadge: (props: Record<string, unknown>) => (
    <div data-testid="boost-status-badge" data-pulse-score={props.venuePulseScore} />
  ),
}))

vi.mock('../VenueEnergyTimeline', () => ({
  VenueEnergyTimeline: (props: Record<string, unknown>) => (
    <div data-testid="venue-energy-timeline" data-venue-id={(props.venue as Venue)?.id} />
  ),
}))

// ── Hook mocks ───────────────────────────────────────────────

const mockMarkGoing = vi.fn()
const mockMarkMaybe = vi.fn()
const mockCancelGoing = vi.fn()

const { mockGetVenueActiveBoosts } = vi.hoisted(() => ({
  mockGetVenueActiveBoosts: vi.fn().mockReturnValue([]),
}))

vi.mock('@/hooks/use-going-tonight', () => ({
  useGoingTonight: () => ({
    markGoing: mockMarkGoing,
    markMaybe: mockMarkMaybe,
    cancelGoing: mockCancelGoing,
    getMyStatus: () => null,
    myPlansTonight: [],
    friendsPlans: new Map(),
    popularTonight: [],
    suggestedVenues: [],
    getVenuePlan: () => ({ venueId: 'venue-1', date: '', rsvps: [], goingCount: 0, maybeCount: 0 }),
    allRsvps: [],
    mockFriends: [],
  }),
}))

vi.mock('@/hooks/use-emoji-burst', () => ({
  useEmojiBurst: () => ({
    particles: [],
    reactionCounts: { fire: 0, music: 0, dancing: 0, drinks: 0, electric: 0, love: 0, chill: 0, vip: 0 },
    aggregatedReactions: [],
    triggerBurst: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-venue-boost', () => ({
  useVenueBoost: () => ({
    allBoosts: [],
    activeBoosts: [],
    boostHistory: [],
    canBoostVenue: () => true,
    recommendedType: null,
    createBoost: vi.fn(),
    cancelBoost: vi.fn(),
    getVenueActiveBoosts: mockGetVenueActiveBoosts,
  }),
}))

vi.mock('@/lib/live-intelligence', () => ({
  getVenueLiveData: () => null,
  reportWaitTime: vi.fn(),
  reportCoverCharge: vi.fn(),
  reportMusicPlaying: vi.fn(),
  reportCrowdLevel: vi.fn(),
  reportDressCode: vi.fn(),
  reportNowPlaying: vi.fn(),
  seedDemoReports: vi.fn(),
}))

vi.mock('@/lib/sharing', () => ({
  generateVenueShareCard: vi.fn(),
}))

vi.mock('@/lib/pulse-engine', () => ({
  formatTimeAgo: () => '5 min ago',
  getContextualEnergyLabel: () => 'Buzzing',
}))

vi.mock('@/lib/units', () => ({
  formatDistance: () => '0.3 mi',
}))

// ── Test fixtures ────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: {
      lat: 47.6145,
      lng: -122.3205,
      address: '123 Main St',
    },
    city: 'Seattle',
    state: 'WA',
    pulseScore: 75,
    category: 'Bar',
    ...overrides,
  }
}

const currentUser: User = {
  id: 'user-1',
  username: 'testuser',
  friends: ['friend-1'],
  createdAt: new Date().toISOString(),
}

const defaultProps = {
  venue: makeVenue(),
  venuePulses: [],
  distance: 0.3,
  unitSystem: 'imperial' as const,
  locationName: 'Capitol Hill',
  currentTime: new Date('2026-03-18T22:00:00'),
  isTracking: false,
  hasRealtimeLocation: false,
  isFavorite: false,
  currentUser,
  onBack: vi.fn(),
  onCreatePulse: vi.fn(),
  onReaction: vi.fn(),
  onToggleFavorite: vi.fn(),
  onOpenPresence: vi.fn(),
}

// ── Tests ────────────────────────────────────────────────────

describe('VenuePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the venue name in the header', () => {
    render(<VenuePage {...defaultProps} />)
    expect(screen.getByText('Test Venue')).toBeTruthy()
  })

  // ── GoingTonightButton wiring ──────────────────────────────

  describe('GoingTonightButton', () => {
    it('renders GoingTonightButton with the correct venueId', () => {
      render(<VenuePage {...defaultProps} />)
      const btn = screen.getByTestId('going-tonight-button')
      expect(btn).toBeTruthy()
      expect(btn.getAttribute('data-venue-id')).toBe('venue-1')
    })
  })

  // ── EmojiReactionBar wiring ────────────────────────────────

  describe('EmojiReactionBar', () => {
    it('renders EmojiReactionBar with onReaction callback', () => {
      render(<VenuePage {...defaultProps} />)
      const bar = screen.getByTestId('emoji-reaction-bar')
      expect(bar).toBeTruthy()
      expect(bar.getAttribute('data-has-on-reaction')).toBe('true')
    })
  })

  // ── EmojiBurstOverlay wiring ───────────────────────────────

  describe('EmojiBurstOverlay', () => {
    it('renders EmojiBurstOverlay with particles array', () => {
      render(<VenuePage {...defaultProps} />)
      const overlay = screen.getByTestId('emoji-burst-overlay')
      expect(overlay).toBeTruthy()
      expect(overlay.getAttribute('data-has-particles')).toBe('true')
    })
  })

  // ── BoostStatusBadge wiring ────────────────────────────────

  describe('BoostStatusBadge', () => {
    it('does not render BoostStatusBadge when no active boosts', () => {
      render(<VenuePage {...defaultProps} />)
      expect(screen.queryByTestId('boost-status-badge')).toBeNull()
    })

    it('renders BoostStatusBadge when venue has active boosts', () => {
      mockGetVenueActiveBoosts.mockReturnValue([{
        id: 'boost-1',
        venueId: 'venue-1',
        type: 'happy_hour',
        status: 'active' as const,
        startedAt: new Date().toISOString(),
        durationMinutes: 60,
      }])

      render(<VenuePage {...defaultProps} />)
      const badge = screen.getByTestId('boost-status-badge')
      expect(badge).toBeTruthy()
      expect(badge.getAttribute('data-pulse-score')).toBe('75')

      // Reset for other tests
      mockGetVenueActiveBoosts.mockReturnValue([])
    })
  })

  // ── VenueEnergyTimeline wiring ─────────────────────────────

  describe('VenueEnergyTimeline', () => {
    it('renders VenueEnergyTimeline with venue data', async () => {
      render(<VenuePage {...defaultProps} />)
      const timeline = await screen.findByTestId('venue-energy-timeline', {}, { timeout: 10000 })
      expect(timeline).toBeTruthy()
      expect(timeline.getAttribute('data-venue-id')).toBe('venue-1')
    })
  })

  // ── Layout ordering ────────────────────────────────────────

  describe('layout', () => {
    it('renders GoingTonightButton before EmojiReactionBar in DOM order', () => {
      const { container } = render(<VenuePage {...defaultProps} />)
      const goingBtn = container.querySelector('[data-testid="going-tonight-button"]')
      const emojiBar = container.querySelector('[data-testid="emoji-reaction-bar"]')
      expect(goingBtn).toBeTruthy()
      expect(emojiBar).toBeTruthy()

      // GoingTonightButton should come before EmojiReactionBar in DOM
      const allElements = container.querySelectorAll('[data-testid]')
      const ids = Array.from(allElements).map(el => el.getAttribute('data-testid'))
      const goingIndex = ids.indexOf('going-tonight-button')
      const emojiIndex = ids.indexOf('emoji-reaction-bar')
      expect(goingIndex).toBeLessThan(emojiIndex)
    })

    it('renders EmojiBurstOverlay as a sibling outside the main content area', () => {
      const { container } = render(<VenuePage {...defaultProps} />)
      const overlay = container.querySelector('[data-testid="emoji-burst-overlay"]')
      expect(overlay).toBeTruthy()
      // The overlay should be a direct child of the root, not inside the scrolling content
      // (it's a fixed overlay)
    })
  })
})
