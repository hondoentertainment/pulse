// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Standard mocks
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      return ({ children, ...props }: any) => {
        const filteredProps: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(props)) {
          if (!['initial','animate','exit','transition','whileHover','whileTap','whileInView','whileDrag','drag','dragConstraints','dragElastic','layout','layoutId','variants','custom','onAnimationComplete','style','dragSnapToOrigin','onDragEnd'].includes(key)) {
            if (typeof value !== 'function' || key.startsWith('on')) {
              filteredProps[key] = value
            }
          }
        }
        return <div {...filteredProps}>{children}</div>
      }
    }
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useSpring: (v: number) => ({ get: () => v, set: () => {} }),
  useTransform: (_: any, fn: any) => ({ get: () => (fn ? fn(0) : 0) }),
  useMotionValue: (v: number) => ({ get: () => v, set: () => {} }),
  useInView: () => true,
}))

vi.mock('@phosphor-icons/react', () => new Proxy({}, {
  get: (_target, prop) => {
    if (prop === '__esModule') return true
    return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />
  }
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: (_key: string, defaultValue: any) => [defaultValue, vi.fn()],
}))

// ---------------------------------------------------------------------------
// Component-specific mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/VenueCard', () => ({
  VenueCard: ({ venue, onClick }: any) => (
    <div data-testid="venue-card" onClick={onClick}>{venue.name}</div>
  ),
}))

vi.mock('@/components/PulseCard', () => ({
  PulseCard: ({ pulse }: any) => (
    <div data-testid="pulse-card">{pulse.id}</div>
  ),
}))

vi.mock('@/components/PulseScore', () => ({
  PulseScore: ({ score }: any) => (
    <div data-testid="pulse-score">{score}</div>
  ),
}))

vi.mock('@/components/NotificationCard', () => ({
  NotificationCard: ({ notification, onClick }: any) => (
    <div data-testid="notification-card" onClick={onClick}>{notification.id}</div>
  ),
}))

vi.mock('@/components/RecommendationCard', () => ({
  RecommendationCard: ({ recommendation, onClick }: any) => (
    <div data-testid="recommendation-card" onClick={onClick}>{recommendation.venue.name}</div>
  ),
}))

vi.mock('@/components/TrendingSections', () => ({
  TrendingSections: ({ sections }: any) => (
    <div data-testid="trending-sections">{sections.length} sections</div>
  ),
}))

vi.mock('@/components/MySpotsFeed', () => ({
  MySpotsFeed: () => <div data-testid="my-spots-feed">My Spots Feed</div>,
}))

vi.mock('@/components/RecommendationsSection', () => ({
  RecommendationsSection: ({ recommendations }: any) => (
    <div data-testid="recommendations-section">{recommendations.length} recs</div>
  ),
}))

vi.mock('@/components/LiveActivityFeed', () => ({
  LiveActivityFeed: () => <div data-testid="live-activity-feed">Live Activity</div>,
}))

vi.mock('@/components/Favorites', () => ({
  Favorites: ({ favoriteVenues }: any) => (
    <div data-testid="favorites">{favoriteVenues.length} favorites</div>
  ),
}))

vi.mock('@/lib/venue-trending', () => ({
  getTrendingSections: () => [],
}))

vi.mock('@/lib/venue-recommendations', () => ({
  getRecommendations: () => [],
}))

vi.mock('@/lib/promoted-discoveries', () => ({
  isPromotionActive: () => false,
  sortWithPromotions: (venues: any[]) => venues,
}))

vi.mock('@/lib/time-contextual-scoring', () => ({
  getDayType: () => 'weekday',
  getPeakCategories: () => [],
  getTimeOfDay: () => 'evening',
}))

vi.mock('@/lib/contextual-intelligence', () => ({
  getSmartVenueSort: (venues: any[]) => venues,
}))

vi.mock('@/lib/personalization-engine', () => ({
  getPersonalizedVenues: () => [],
  getVenueRecommendationReason: () => 'Great vibe match',
}))

vi.mock('@/lib/notification-grouping', () => ({
  groupNotifications: () => [],
}))

vi.mock('@/lib/social-graph', () => ({
  generateActivityDigest: () => ({ entries: [] }),
  formatSuggestionReason: (reason: any) =>
    reason.type === 'mutual_friends'
      ? `${reason.count} mutual friends`
      : 'Seen at same venues',
}))

vi.mock('@/lib/challenges', () => ({}))

vi.mock('@/lib/venue-challenges', () => ({
  getActiveChallenges: (c: any[]) => c,
  getUserActiveChallenges: () => [],
  getChallengeTimeRemaining: () => ({ days: 1, hours: 5, expired: false }),
}))

vi.mock('@/lib/units', () => ({
  formatDistance: (d: number) => `${d.toFixed(1)} mi`,
}))

vi.mock('@/lib/performance-engine', () => ({
  calculateVisibleRange: () => ({ startIndex: 0, endIndex: 5 }),
}))

vi.mock('@/lib/stories', () => ({
  getStoryRings: (stories: any[], currentUserId: string) =>
    stories.map((s: any) => ({
      userId: s.userId,
      username: s.username,
      profilePhoto: undefined,
      hasUnviewed: !s.viewedBy.includes(currentUserId),
      stories: [s],
    })),
  STORY_REACTIONS: ['🔥', '⚡', '😍'],
}))

vi.mock('@/lib/pulse-engine', () => ({
  getEnergyLabel: () => 'Buzzing',
  formatTimeAgo: () => '5m ago',
}))

vi.mock('@/lib/content-moderation', () => ({}))

vi.mock('@/hooks/use-notification-settings', () => ({
  useNotificationSettings: () => ({ settings: { groupReactions: true, groupFriendPulses: false, groupTrendingVenues: false }, updateSettings: vi.fn() }),
}))

vi.mock('@/lib/social-coordination', () => ({}))

vi.mock('@/lib/types', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    ENERGY_CONFIG: {
      dead: { label: 'Dead', value: 0, color: '#666', emoji: '💀' },
      chill: { label: 'Chill', value: 1, color: '#4ade80', emoji: '😎' },
      buzzing: { label: 'Buzzing', value: 2, color: '#f59e0b', emoji: '🔥' },
      electric: { label: 'Electric', value: 3, color: '#d946ef', emoji: '⚡' },
    },
  }
})

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeVenue(overrides: any = {}) {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    city: 'New York',
    state: 'NY',
    pulseScore: 75,
    category: 'Bar',
    lastPulseAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeUser(overrides: any = {}) {
  return {
    id: 'user-1',
    username: 'testuser',
    friends: ['friend-1'],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makePulse(overrides: any = {}) {
  return {
    id: 'pulse-1',
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'buzzing' as const,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5400000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 10,
    ...overrides,
  }
}

function makePulseWithUser(overrides: any = {}) {
  const pulse = makePulse(overrides)
  return { ...pulse, user: makeUser(), venue: makeVenue(), ...overrides }
}

// ---------------------------------------------------------------------------
// 1. TrendingSections
// ---------------------------------------------------------------------------

describe('TrendingSections', () => {
  it('renders section titles', async () => {
    // Use the real component (unmock for this suite)
    const { TrendingSections } = await import('@/components/TrendingSections')

    const sections = [
      { title: 'Trending Now', venues: [makeVenue()], description: 'Hot spots', updatedAt: new Date().toISOString() },
      { title: 'Just Popped Off', venues: [makeVenue({ id: 'v2', name: 'Club X' })], description: 'New energy', updatedAt: new Date().toISOString() },
    ]

    render(
      <TrendingSections
        sections={sections}
        userLocation={null}
        onVenueClick={vi.fn()}
        isFavorite={() => false}
        onToggleFavorite={vi.fn()}
      />
    )

    expect(screen.getByText('Trending Now')).toBeDefined()
    expect(screen.getByText('Just Popped Off')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 2. TrendingTab
// ---------------------------------------------------------------------------

describe('TrendingTab', () => {
  it('renders Trending and My Spots tabs', async () => {
    const { TrendingTab } = await import('@/components/TrendingTab')

    render(
      <TrendingTab
        venues={[]}
        pulses={[]}
        pulsesWithUsers={[]}
        favoriteVenues={[]}
        followedVenues={[]}
        userLocation={null}
        unitSystem="imperial"
        currentUser={makeUser()}
        allUsers={[makeUser()]}
        trendingSubTab="trending"
        onSubTabChange={vi.fn()}
        onVenueClick={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleFollow={vi.fn()}
        onReaction={vi.fn()}
        isFavorite={() => false}
      />
    )

    expect(screen.getByText('Trending')).toBeDefined()
    expect(screen.getByText('My Spots')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 3. NotificationFeed
// ---------------------------------------------------------------------------

describe('NotificationFeed', () => {
  it('renders All and Unread tabs when notifications exist', async () => {
    // Override groupNotifications to return some notifications
    const { groupNotifications } = await import('@/lib/notification-grouping')
    vi.mocked(groupNotifications).mockReturnValue([
      { id: 'n1', type: 'friend_pulse', read: false, createdAt: new Date().toISOString(), pulseId: 'p1', venueId: 'v1' },
    ] as any)

    const { NotificationFeed } = await import('@/components/NotificationFeed')

    render(
      <NotificationFeed
        currentUser={makeUser()}
        pulses={[makePulse()]}
        venues={[makeVenue()]}
        onNotificationClick={vi.fn()}
      />
    )

    expect(screen.getByText('All')).toBeDefined()
    expect(screen.getByText(/Unread/)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 4. ForYouFeed
// ---------------------------------------------------------------------------

describe('ForYouFeed', () => {
  it('renders For You heading when venues are provided', async () => {
    const { getPersonalizedVenues } = await import('@/lib/personalization-engine')
    vi.mocked(getPersonalizedVenues).mockReturnValue([
      { venue: makeVenue(), personalScore: 0.9, reasons: ['Great vibe'], distance: 0.5 },
    ] as any)

    const mod = await import('@/components/ForYouFeed')
    const ForYouFeed = mod.default

    render(
      <ForYouFeed
        venues={[makeVenue()]}
        user={makeUser()}
        pulses={[makePulse()]}
        userLocation={{ lat: 40.7, lng: -74.0 }}
        onVenueClick={vi.fn()}
      />
    )

    expect(screen.getByText('For You')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 5. MySpotsFeed
// ---------------------------------------------------------------------------

describe('MySpotsFeed', () => {
  it('renders followed venues', async () => {
    // Unmock MySpotsFeed for direct testing
    vi.doUnmock('@/components/MySpotsFeed')
    const { MySpotsFeed } = await import('@/components/MySpotsFeed')

    const venues = [makeVenue(), makeVenue({ id: 'venue-2', name: 'Lounge B' })]

    render(
      <MySpotsFeed
        followedVenues={venues}
        pulses={[]}
        userLocation={null}
        unitSystem="imperial"
        currentUserId="user-1"
        onVenueClick={vi.fn()}
        onToggleFollow={vi.fn()}
        onReaction={vi.fn()}
      />
    )

    expect(screen.getByText('Test Venue')).toBeDefined()
    expect(screen.getByText('Lounge B')).toBeDefined()
  })

  it('shows empty state when no venues', async () => {
    vi.doUnmock('@/components/MySpotsFeed')
    const { MySpotsFeed } = await import('@/components/MySpotsFeed')

    render(
      <MySpotsFeed
        followedVenues={[]}
        pulses={[]}
        userLocation={null}
        unitSystem="imperial"
        currentUserId="user-1"
        onVenueClick={vi.fn()}
        onToggleFollow={vi.fn()}
        onReaction={vi.fn()}
      />
    )

    expect(screen.getByText('No Followed Venues Yet')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 6. LiveActivityFeed
// ---------------------------------------------------------------------------

describe('LiveActivityFeed', () => {
  it('renders activity feed heading', async () => {
    vi.doUnmock('@/components/LiveActivityFeed')
    const { generateActivityDigest } = await import('@/lib/social-graph')
    vi.mocked(generateActivityDigest).mockReturnValue({
      entries: [
        {
          userId: 'friend-1',
          username: 'frienduser',
          venues: [{ venueId: 'venue-1', venueName: 'Test Venue', energyRating: 'buzzing', timestamp: new Date().toISOString() }],
        },
      ],
    } as any)

    const { LiveActivityFeed } = await import('@/components/LiveActivityFeed')

    render(
      <LiveActivityFeed
        currentUser={makeUser()}
        allUsers={[makeUser(), makeUser({ id: 'friend-1', username: 'frienduser' })]}
        venues={[makeVenue()]}
        pulses={[makePulse()]}
        onVenueClick={vi.fn()}
      />
    )

    expect(screen.getByText('Friend Activity')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 7. FriendActivityTimeline
// ---------------------------------------------------------------------------

describe('FriendActivityTimeline', () => {
  it('renders timeline entries with usernames', async () => {
    const { FriendActivityTimeline } = await import('@/components/FriendActivityTimeline')

    const entries = [
      {
        userId: 'user-1',
        username: 'alice',
        venueId: 'venue-1',
        venueName: 'Test Venue',
        action: 'check_in' as const,
        timestamp: new Date().toISOString(),
        energyRating: 'buzzing' as const,
      },
      {
        userId: 'user-2',
        username: 'bob',
        venueId: 'venue-2',
        venueName: 'Club X',
        action: 'pulse' as const,
        timestamp: new Date().toISOString(),
      },
    ]

    render(
      <FriendActivityTimeline entries={entries} onVenueTap={vi.fn()} />
    )

    expect(screen.getByText('alice')).toBeDefined()
    expect(screen.getByText('bob')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 8. ChallengeFeed
// ---------------------------------------------------------------------------

describe('ChallengeFeed', () => {
  it('renders heading and challenge list', async () => {
    const { ChallengeFeed } = await import('@/components/ChallengeFeed')

    const challenges = [
      {
        id: 'ch-1',
        title: 'Friday Night Out',
        description: 'Post from the venue',
        venueId: 'venue-1',
        sponsorVenueName: 'Test Venue',
        challengeType: 'post-from-venue',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        participants: [],
        maxParticipants: 50,
        entries: [],
        reward: { type: 'cash', value: 100, description: '$100 Cash' },
        requirements: { visitVenue: true, includePhoto: false },
        status: 'active',
      },
    ]

    render(
      <ChallengeFeed
        challenges={challenges as any}
        venues={[makeVenue()]}
        currentUserId="user-1"
        onBack={vi.fn()}
        onJoinChallenge={vi.fn()}
      />
    )

    expect(screen.getByText('Challenges')).toBeDefined()
    expect(screen.getByText('Friday Night Out')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 9. RecommendationsSection
// ---------------------------------------------------------------------------

describe('RecommendationsSection', () => {
  it('renders You Might Like heading', async () => {
    vi.doUnmock('@/components/RecommendationsSection')
    const { RecommendationsSection } = await import('@/components/RecommendationsSection')

    const recommendations = [
      { venue: makeVenue(), score: 0.85, reasons: ['Popular with friends'] },
      { venue: makeVenue({ id: 'v2', name: 'Spot B' }), score: 0.7, reasons: ['Near you'] },
    ]

    render(
      <RecommendationsSection
        recommendations={recommendations as any}
        onVenueClick={vi.fn()}
      />
    )

    expect(screen.getByText('You Might Like')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 10. Favorites
// ---------------------------------------------------------------------------

describe('Favorites', () => {
  it('renders favorite venue names', async () => {
    vi.doUnmock('@/components/Favorites')
    const { Favorites } = await import('@/components/Favorites')

    const venues = [
      makeVenue({ id: 'v1', name: 'Favorite Bar' }),
      makeVenue({ id: 'v2', name: 'Favorite Club' }),
    ]

    render(
      <Favorites
        favoriteVenues={venues}
        userLocation={null}
        unitSystem="imperial"
        onVenueClick={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    )

    expect(screen.getByText('Favorite Bar')).toBeDefined()
    expect(screen.getByText('Favorite Club')).toBeDefined()
  })

  it('shows empty state when no favorites', async () => {
    vi.doUnmock('@/components/Favorites')
    const { Favorites } = await import('@/components/Favorites')

    render(
      <Favorites
        favoriteVenues={[]}
        userLocation={null}
        unitSystem="imperial"
        onVenueClick={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    )

    expect(screen.getByText('No favorite venues yet')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 11. StoryRing
// ---------------------------------------------------------------------------

describe('StoryRing', () => {
  it('renders story rings with usernames', async () => {
    const { StoryRing } = await import('@/components/StoryRing')

    const stories = [
      {
        id: 's1',
        userId: 'user-a',
        username: 'alice',
        venueId: 'venue-1',
        venueName: 'Test Venue',
        energyRating: 'buzzing' as const,
        photos: [],
        reactions: {},
        viewedBy: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        viewCount: 0,
      },
      {
        id: 's2',
        userId: 'user-b',
        username: 'bob',
        venueId: 'venue-1',
        venueName: 'Test Venue',
        energyRating: 'chill' as const,
        photos: [],
        reactions: {},
        viewedBy: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        viewCount: 0,
      },
    ]

    render(
      <StoryRing stories={stories as any} currentUserId="me" onStoryClick={vi.fn()} />
    )

    expect(screen.getByText('alice')).toBeDefined()
    expect(screen.getByText('bob')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 12. StoryViewer
// ---------------------------------------------------------------------------

describe('StoryViewer', () => {
  it('renders story viewer with close mechanism', async () => {
    const { StoryViewer } = await import('@/components/StoryViewer')

    const stories = [
      {
        id: 's1',
        userId: 'user-a',
        username: 'alice',
        venueId: 'venue-1',
        venueName: 'Cool Bar',
        energyRating: 'buzzing' as const,
        caption: 'Great vibes!',
        photos: [],
        reactions: { '🔥': [], '⚡': [], '😍': [], '🙌': [], '💀': [], '👀': [] },
        viewedBy: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        viewCount: 5,
      },
    ]

    const onClose = vi.fn()

    render(
      <StoryViewer
        stories={stories as any}
        initialIndex={0}
        currentUserId="me"
        onClose={onClose}
        onReact={vi.fn()}
      />
    )

    // The story viewer should display venue name
    expect(screen.getByText('Cool Bar')).toBeDefined()

    // Close button should exist (X icon rendered as span by the phosphor mock)
    const closeIcon = screen.getByTestId('icon-X')
    // The close button is the parent of the icon
    const closeButton = closeIcon.closest('button')
    expect(closeButton).not.toBeNull()
    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 13. VirtualizedList
// ---------------------------------------------------------------------------

describe('VirtualizedList', () => {
  it('renders visible items', async () => {
    const { VirtualizedList } = await import('@/components/VirtualizedList')

    const items = Array.from({ length: 20 }, (_, i) => `Item ${i}`)

    render(
      <VirtualizedList
        items={items}
        renderItem={(item) => <div>{item}</div>}
        itemHeight={50}
        containerHeight={300}
        overscan={2}
      />
    )

    // calculateVisibleRange mock returns { startIndex: 0, endIndex: 5 }
    expect(screen.getByText('Item 0')).toBeDefined()
    expect(screen.getByText('Item 5')).toBeDefined()
    // Items beyond endIndex should not be rendered
    expect(screen.queryByText('Item 10')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 14. PullToRefresh
// ---------------------------------------------------------------------------

describe('PullToRefresh', () => {
  it('renders children', async () => {
    const { PullToRefresh } = await import('@/components/PullToRefresh')

    render(
      <PullToRefresh onRefresh={async () => {}}>
        <p>Hello Content</p>
      </PullToRefresh>
    )

    expect(screen.getByText('Hello Content')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 15. FriendSuggestions
// ---------------------------------------------------------------------------

describe('FriendSuggestions', () => {
  it('renders suggestion list with usernames and Add button', async () => {
    const { FriendSuggestions } = await import('@/components/FriendSuggestions')

    const suggestions = [
      {
        user: makeUser({ id: 'sug-1', username: 'charlie' }),
        reason: { type: 'mutual_friends' as const, count: 3 },
        score: 0.9,
      },
      {
        user: makeUser({ id: 'sug-2', username: 'dana' }),
        reason: { type: 'co_located' as const, venueCount: 2, venueName: 'Spot' },
        score: 0.7,
      },
    ]

    const onAddFriend = vi.fn()

    render(
      <FriendSuggestions suggestions={suggestions as any} onAddFriend={onAddFriend} />
    )

    expect(screen.getByText('charlie')).toBeDefined()
    expect(screen.getByText('dana')).toBeDefined()

    // Should have Add buttons
    const addButtons = screen.getAllByText('Add')
    expect(addButtons.length).toBe(2)

    // Click first Add button
    fireEvent.click(addButtons[0])
    expect(onAddFriend).toHaveBeenCalledWith('sug-1')
  })
})
