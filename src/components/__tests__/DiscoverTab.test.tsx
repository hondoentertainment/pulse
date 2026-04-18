// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Venue, User, Pulse, PulseWithUser } from '@/lib/types'
import type { TonightsPick } from '@/lib/tonights-pick'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseTonightsPick = vi.fn()

vi.mock('@/hooks/use-tonights-pick', () => ({
  useTonightsPick: (...args: unknown[]) => mockUseTonightsPick(...args),
}))

const mockUseLiveActivityFeed = vi.fn()

vi.mock('@/hooks/use-live-activity-feed', () => ({
  useLiveActivityFeed: (...args: unknown[]) => mockUseLiveActivityFeed(...args),
}))

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
    circle: (props: Record<string, unknown>) => (
      <circle {...(props as React.SVGProps<SVGCircleElement>)} />
    ),
  },
  useReducedMotion: () => false,
}))

const { MockIcon } = vi.hoisted(() => {
  const MockIcon = () => null
  return { MockIcon }
})

vi.mock('@phosphor-icons/react', () => ({
  Compass: MockIcon,
  CalendarBlank: MockIcon,
  UsersThree: MockIcon,
  Trophy: MockIcon,
  ChartBar: MockIcon,
  MapTrifold: MockIcon,
  MusicNotes: MockIcon,
  GearSix: MockIcon,
  Lightning: MockIcon,
  Ticket: MockIcon,
  Sparkle: MockIcon,
  HeartStraight: MockIcon,
  X: MockIcon,
  MapPin: MockIcon,
  Users: MockIcon,
  ArrowRight: MockIcon,
  CaretDown: MockIcon,
  CaretUp: MockIcon,
  MusicNote: MockIcon,
  ForkKnife: MockIcon,
  Coffee: MockIcon,
  Star: MockIcon,
  Beer: MockIcon,
  TrendUp: MockIcon,
  MartiniGlass: MockIcon,
  Question: MockIcon,
}))

vi.mock('@/lib/stories', () => ({
  getActiveStories: () => [],
}))

vi.mock('@/lib/events', () => ({
  getEventsSoon: () => [],
}))

vi.mock('@/lib/social-graph', () => ({
  getPeopleYouMayKnow: () => [],
}))

vi.mock('@/components/StoryRing', () => ({
  StoryRing: () => <div data-testid="story-ring" />,
}))

vi.mock('@/components/FriendSuggestions', () => ({
  FriendSuggestions: () => <div data-testid="friend-suggestions" />,
}))

vi.mock('@/components/EventCard', () => ({
  EventCard: () => <div data-testid="event-card" />,
}))

vi.mock('@/components/PredictiveSurgePanel', () => ({
  PredictiveSurgePanel: () => <div data-testid="predictive-surge" />,
}))

vi.mock('@/components/MySpotsFeed', () => ({
  MySpotsFeed: () => <div data-testid="my-spots-feed" />,
}))

vi.mock('@/components/ForYouFeed', () => ({
  default: () => <div data-testid="for-you-feed" />,
}))

vi.mock('@/components/MoodSelector', () => ({
  default: () => <div data-testid="mood-selector" />,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: () => [null, vi.fn()],
}))

import { DiscoverTab } from '../DiscoverTab'

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

function makePick(overrides: Partial<TonightsPick> = {}): TonightsPick {
  return {
    venue: makeVenue(),
    score: 0.8,
    reasons: ['great vibes'],
    explanation: 'Great vibes tonight',
    confidence: 0.75,
    alternates: [],
    ...overrides,
  }
}

const defaultProps = {
  venues: [makeVenue()],
  pulses: [] as Pulse[],
  pulsesWithUsers: [] as PulseWithUser[],
  currentUser: makeUser(),
  allUsers: [makeUser()],
  stories: [],
  events: [],
  followedVenues: [],
  userLocation: null,
  unitSystem: 'imperial' as const,
  discoverSubTab: 'for-you' as const,
  onSubTabChange: vi.fn(),
  onVenueClick: vi.fn(),
  onStoryClick: vi.fn(),
  onAddFriend: vi.fn(),
  onToggleFollow: vi.fn(),
  onReaction: vi.fn(),
  onNavigate: vi.fn(),
}

const defaultPickHookReturn = {
  pick: null as TonightsPick | null,
  isLoading: false,
  isDismissed: false,
  showAlternates: false,
  dismiss: vi.fn(),
  refresh: vi.fn(),
  toggleAlternates: vi.fn(),
}

const defaultFeedHookReturn = {
  events: [],
  latestEvent: null,
  isLive: true,
  pauseFeed: vi.fn(),
  resumeFeed: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DiscoverTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockUseTonightsPick.mockReturnValue({ ...defaultPickHookReturn })
    mockUseLiveActivityFeed.mockReturnValue({ ...defaultFeedHookReturn })
  })

  it('renders the Discover heading', () => {
    render(<DiscoverTab {...defaultProps} />)
    expect(screen.getByText('Discover')).toBeTruthy()
  })

  it('renders TonightsPickCard in the for-you sub-tab when pick is available', () => {
    const pick = makePick()
    mockUseTonightsPick.mockReturnValue({
      ...defaultPickHookReturn,
      pick,
    })

    render(<DiscoverTab {...defaultProps} />)
    expect(screen.getByTestId('tonights-pick-card')).toBeTruthy()
    expect(screen.getByText('Neon Lounge')).toBeTruthy()
  })

  it('renders TonightsPickCard skeleton when loading', () => {
    mockUseTonightsPick.mockReturnValue({
      ...defaultPickHookReturn,
      isLoading: true,
    })

    render(<DiscoverTab {...defaultProps} />)
    expect(screen.getByTestId('pick-skeleton')).toBeTruthy()
  })

  it('does not render TonightsPickCard when pick is null', () => {
    mockUseTonightsPick.mockReturnValue({
      ...defaultPickHookReturn,
      pick: null,
    })

    render(<DiscoverTab {...defaultProps} />)
    expect(screen.queryByTestId('tonights-pick-card')).toBeNull()
  })

  it('renders Live Activity section header in for-you sub-tab', () => {
    render(<DiscoverTab {...defaultProps} />)
    expect(screen.getByText('Live Activity')).toBeTruthy()
  })

  it('renders LiveActivityFeed in the for-you sub-tab', () => {
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultFeedHookReturn,
      events: [],
    })

    render(<DiscoverTab {...defaultProps} />)
    // The empty state message from LiveActivityFeed
    expect(screen.getByText(/No activity nearby/)).toBeTruthy()
  })

  it('TonightsPickCard appears before LiveActivityFeed in the DOM', () => {
    const pick = makePick()
    mockUseTonightsPick.mockReturnValue({
      ...defaultPickHookReturn,
      pick,
    })
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultFeedHookReturn,
      events: [],
    })

    const { container } = render(<DiscoverTab {...defaultProps} />)
    const pickCard = container.querySelector('[data-testid="tonights-pick-card"]')
    const liveHeader = screen.getByText('Live Activity')

    // Pick card should come before the live activity header in the DOM
    expect(pickCard).toBeTruthy()
    expect(liveHeader).toBeTruthy()
    // Use compareDocumentPosition to verify order
    const position = pickCard!.compareDocumentPosition(liveHeader)
    // DOCUMENT_POSITION_FOLLOWING means liveHeader comes after pickCard
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not render for-you content when my-spots sub-tab is active', () => {
    render(<DiscoverTab {...defaultProps} discoverSubTab="my-spots" />)
    expect(screen.queryByText('Live Activity')).toBeNull()
    expect(screen.getByTestId('my-spots-feed')).toBeTruthy()
  })

  it('passes venues and currentUser to useTonightsPick hook', () => {
    const venues = [makeVenue({ id: 'v-1' }), makeVenue({ id: 'v-2' })]
    const user = makeUser({ id: 'u-99' })

    render(<DiscoverTab {...defaultProps} venues={venues} currentUser={user} />)

    expect(mockUseTonightsPick).toHaveBeenCalledWith(
      venues,
      user,
      expect.anything(),
      null,
    )
  })
})
