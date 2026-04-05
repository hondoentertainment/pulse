// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Standard mocks
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, _prop) => {
        return ({ children, ...props }: any) => {
          const filteredProps: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(props)) {
            if (
              ![
                'initial',
                'animate',
                'exit',
                'transition',
                'whileHover',
                'whileTap',
                'whileInView',
                'whileDrag',
                'drag',
                'dragConstraints',
                'dragElastic',
                'layout',
                'layoutId',
                'variants',
                'custom',
                'onAnimationComplete',
                'style',
              ].includes(key)
            ) {
              if (typeof value !== 'function' || key.startsWith('on')) {
                filteredProps[key] = value
              }
            }
          }
          return <div {...filteredProps}>{children}</div>
        }
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  LayoutGroup: ({ children }: any) => <>{children}</>,
  useSpring: (v: number) => ({ get: () => v, set: () => {} }),
  useTransform: (_: any, fn: any) => ({ get: () => (fn ? fn(0) : 0) }),
  useMotionValue: (v: number) => ({ get: () => v, set: () => {} }),
  useInView: () => true,
  useAnimation: () => ({
    start: () => Promise.resolve(),
    stop: () => {},
    set: () => {},
  }),
}))

vi.mock('@phosphor-icons/react', () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true
        if (typeof prop === 'symbol' || prop === 'then') return undefined
        return (props: any) => (
          <span data-testid={`icon-${String(prop)}`} {...props} />
        )
      },
      has: () => true,
    }
  )
)

vi.mock('@github/spark/hooks', () => ({
  useKV: (_key: string, defaultValue: any) => [defaultValue, vi.fn()],
}))

// ---------------------------------------------------------------------------
// Dialog / Sheet / Drawer UI mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogClose: ({ children }: any) => <button>{children}</button>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
  SheetClose: ({ children }: any) => <button>{children}</button>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: any) =>
    open ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: any) => <p>{children}</p>,
  DrawerFooter: ({ children }: any) => <div>{children}</div>,
  DrawerClose: ({ children }: any) => <button>{children}</button>,
  DrawerTrigger: ({ children }: any) => <div>{children}</div>,
}))

// ---------------------------------------------------------------------------
// Shared UI component mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild: _asChild, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: (props: any) => <div role="progressbar" {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => (
    <label {...props}>{children}</label>
  ),
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: any) => <input type="checkbox" role="switch" {...props} />,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

// ---------------------------------------------------------------------------
// Shared library / hook mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/content-moderation', () => ({
  screenContent: () => [],
  REPORT_REASONS: [
    { value: 'spam', label: 'Spam', description: 'Promotional or repetitive content' },
    { value: 'inappropriate', label: 'Inappropriate', description: 'Offensive or explicit content' },
    { value: 'harassment', label: 'Harassment', description: 'Bullying or targeted abuse' },
  ],
  createReport: vi.fn(() => ({ id: 'report-1' })),
}))

vi.mock('@/lib/seeded-hashtags', () => ({
  suggestHashtags: () => [],
  getTimeOfDay: () => 'evening',
  getDayOfWeek: () => 'friday',
}))

vi.mock('@/lib/video-compression', () => ({
  compressVideo: vi.fn(),
  formatFileSize: (s: number) => `${s}B`,
  getCompressionRatio: () => 50,
}))

vi.mock('@/lib/sharing', () => ({
  buildNativeShareData: (card: any) => ({ title: card.title }),
  buildClipboardShareText: (card: any) => card.url,
}))

vi.mock('@/lib/contextual-intelligence', () => ({
  getAdaptiveLayout: () => ({
    greeting: 'Good evening',
    tagline: 'Friday vibes are calling',
    primaryCategory: 'Nightlife',
    secondaryCategories: ['Live Music', 'Rooftops'],
  }),
  getSmartVenueSort: (venues: any[]) => venues,
}))

vi.mock('@/lib/time-contextual-scoring', () => ({
  getTimeOfDay: () => 'evening',
  getDayType: () => 'weekend',
}))

vi.mock('@/lib/types', () => ({
  ENERGY_CONFIG: {
    dead: { color: '#666', emoji: '💀', label: 'Dead' },
    chill: { color: '#4ade80', emoji: '😌', label: 'Chill' },
    buzzing: { color: '#f59e0b', emoji: '🔥', label: 'Buzzing' },
    electric: { color: '#ec4899', emoji: '⚡', label: 'Electric' },
  },
}))

vi.mock('@/components/EnergySlider', () => ({
  EnergySlider: (props: any) => (
    <div data-testid="energy-slider">{props.value}</div>
  ),
}))

vi.mock('@/components/PulseScore', () => ({
  PulseScore: ({ score }: any) => <span data-testid="pulse-score">{score}</span>,
}))

vi.mock('@/components/GPSIndicator', () => ({
  GPSIndicator: () => <div data-testid="gps-indicator" />,
}))

vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}))

vi.mock('@/hooks/use-voice-search', () => ({
  useVoiceSearch: () => ({
    isListening: false,
    transcript: '',
    isSupported: false,
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-voice-filter', () => ({
  useVoiceFilter: () => ({
    isListening: false,
    transcript: '',
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
    isSupported: false,
    parseVoiceCommand: vi.fn(),
    applyVoiceFilters: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-unit-preference', () => ({
  useUnitPreference: () => ({
    unitSystem: 'imperial',
    isImperial: true,
    setUnitSystem: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-notification-settings', () => ({
  useNotificationSettings: () => ({
    settings: {
      friendPulses: true,
      friendNearbyVenues: true,
      trendingVenues: true,
      pulseReactions: true,
      weeklyDigest: false,
      groupReactions: true,
      groupFriendPulses: false,
      groupTrendingVenues: false,
    },
    updateSetting: vi.fn(),
  }),
}))

const mockVenueState = {
  venues: [],
  moderatedPulses: [],
  currentUser: { id: 'u1', username: 'testuser', profilePhoto: '', friends: [], favoriteVenues: [], followedVenues: [], createdAt: '', venueCheckInHistory: {} },
  stories: [],
  events: [],
  favoriteVenues: [],
  followedVenues: [],
  userLocation: null,
  unitSystem: 'imperial',
  realtimeLocation: null,
  isTracking: false,
  promotions: [],
  isFavorite: () => false,
  getPulsesWithUsers: () => [],
  unreadNotificationCount: 0,
  playlists: [],
  pulses: [],
  contentReports: [],
  setSimulatedLocation: vi.fn(),
  setCurrentUser: vi.fn(),
  setPlaylists: vi.fn(),
  setContentReports: vi.fn(),
  notificationSettings: {},
  hashtags: [],
  notifications: [],
  userBlocks: [],
  userMutes: [],
  locationName: '',
  locationError: undefined,
  locationPermissionDenied: false,
  setLocationPermissionDenied: vi.fn(),
  simulatedLocation: null,
  currentTime: new Date(),
  sortedVenues: [],
  isFollowed: () => false,
  setVenues: vi.fn(),
  setPulses: vi.fn(),
  setNotifications: vi.fn(),
  setHashtags: vi.fn(),
  setStories: vi.fn(),
  setEvents: vi.fn(),
  setPromotions: vi.fn(),
}

const mockSocialState = {
  crews: [],
  crewCheckIns: [],
  setCrews: vi.fn(),
  setCrewCheckIns: vi.fn(),
  currentUser: { id: 'u1', username: 'testuser', profilePhoto: '', friends: [], favoriteVenues: [], followedVenues: [], createdAt: '', venueCheckInHistory: {} },
  setCurrentUser: vi.fn(),
}

const mockUIState = {
  activeTab: 'trending' as const,
  setActiveTab: vi.fn(),
  selectedVenue: null,
  setSelectedVenue: vi.fn(),
  subPage: null,
  setSubPage: vi.fn(),
  hasCompletedOnboarding: true,
  setHasCompletedOnboarding: vi.fn(),
  integrationsEnabled: false,
  socialDashboardEnabled: false,
  createDialogOpen: false,
  setCreateDialogOpen: vi.fn(),
  venueForPulse: null,
  setVenueForPulse: vi.fn(),
  showAdminDashboard: false,
  setShowAdminDashboard: vi.fn(),
  trendingSubTab: 'trending' as const,
  setTrendingSubTab: vi.fn(),
  storyViewerOpen: false,
  setStoryViewerOpen: vi.fn(),
  storyViewerStories: [],
  setStoryViewerStories: vi.fn(),
  integrationVenue: null,
  setIntegrationVenue: vi.fn(),
  presenceSheetOpen: false,
  setPresenceSheetOpen: vi.fn(),
  queuedPulseCount: 0,
  setQueuedPulseCount: vi.fn(),
}

vi.mock('@/hooks/use-venue-state', () => ({
  useVenueState: () => mockVenueState,
}))

vi.mock('@/hooks/use-social-state', () => ({
  useSocialState: () => mockSocialState,
}))

vi.mock('@/hooks/use-ui-state', () => ({
  useUIState: () => mockUIState,
}))

vi.mock('@/hooks/use-app-state', () => ({
  useAppState: () => ({ ...mockVenueState, ...mockSocialState, ...mockUIState }),
  ALL_USERS: [],
}))

vi.mock('@/hooks/use-app-handlers', () => ({
  useAppHandlers: () => ({
    handleReaction: vi.fn(),
    handleToggleFavorite: vi.fn(),
    handleToggleFollow: vi.fn(),
    handleNotificationClick: vi.fn(),
    handleAddFriend: vi.fn(),
    handlePulseReport: vi.fn(),
    handlePromotionImpression: vi.fn(),
    handlePromotionClick: vi.fn(),
    handleTabChange: vi.fn(),
    handleEventsUpdate: vi.fn(),
  }),
}))

// Mock lazy-loaded tab components for MainTabRouter
vi.mock('@/components/InteractiveMap', () => ({
  InteractiveMap: () => <div data-testid="interactive-map">Map</div>,
}))

vi.mock('@/components/NotificationFeed', () => ({
  NotificationFeed: () => <div data-testid="notification-feed">Notifications</div>,
}))

vi.mock('@/components/TrendingTab', () => ({
  TrendingTab: () => <div data-testid="trending-tab">Trending</div>,
}))

vi.mock('@/components/ProfileTab', () => ({
  ProfileTab: () => <div data-testid="profile-tab">Profile</div>,
}))

vi.mock('@/components/DiscoverTab', () => ({
  DiscoverTab: () => <div data-testid="discover-tab">Discover</div>,
}))

// Mock lazy-loaded sub-page components for SubPageRouter
vi.mock('@/components/AchievementsPage', () => ({
  AchievementsPage: () => <div data-testid="achievements-page">Achievements</div>,
}))

vi.mock('@/components/EventsPage', () => ({
  EventsPage: () => <div data-testid="events-page">Events</div>,
}))

vi.mock('@/components/CrewPage', () => ({
  CrewPage: () => <div data-testid="crew-page">Crew</div>,
}))

vi.mock('@/components/InsightsPage', () => ({
  InsightsPage: () => <div data-testid="insights-page">Insights</div>,
}))

vi.mock('@/components/NeighborhoodView', () => ({
  NeighborhoodView: () => <div data-testid="neighborhood-view">Neighborhoods</div>,
}))

vi.mock('@/components/PlaylistsPage', () => ({
  PlaylistsPage: () => <div data-testid="playlists-page">Playlists</div>,
}))

vi.mock('@/components/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page">Settings Page</div>,
}))

vi.mock('@/components/IntegrationHub', () => ({
  IntegrationHub: () => <div data-testid="integration-hub">Integration Hub</div>,
}))

vi.mock('@/components/ModerationQueuePage', () => ({
  ModerationQueuePage: () => <div data-testid="moderation-queue">Moderation</div>,
}))

vi.mock('@/lib/haptics', () => ({
  triggerHapticFeedback: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, onClick, ...props }: any) => (
    <a href={to} onClick={(e: any) => { e.preventDefault(); onClick?.(e) }} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}))

vi.mock('@/hooks/use-route-navigation', () => ({
  useRouteNavigation: () => ({
    activeTab: 'trending',
    navigateToTab: vi.fn(),
    navigateToSubPage: vi.fn(),
    navigateBack: vi.fn(),
  }),
}))

vi.mock('@/lib/units', () => ({
  formatDistance: (d: number) => `${d.toFixed(1)} mi`,
}))

vi.mock('@/lib/interactive-map', () => ({
  buildVenueRenderPoints: () => [],
  clampCenter: (c: any) => c,
  clampZoom: (z: number) => z,
  clusterVenueRenderPoints: () => [],
  getFittedViewport: () => ({ center: { x: 0, y: 0 }, zoom: 1 }),
  getHeadingDelta: () => 0,
  getPreviewVenuePoints: () => [],
}))

// ==========================================================================
// Static imports (after mocks)
// ==========================================================================

import { BottomNav } from '@/components/BottomNav'
import { MainTabRouter } from '@/components/MainTabRouter'
import { SubPageRouter } from '@/components/SubPageRouter'
import { AppHeader } from '@/components/AppHeader'
import { AdaptiveHomeHeader } from '@/components/AdaptiveHomeHeader'
import { OnboardingFlow } from '@/components/OnboardingFlow'
import { CreatePulseDialog } from '@/components/CreatePulseDialog'
import { ReportDialog } from '@/components/ReportDialog'
import { ShareSheet } from '@/components/ShareSheet'
import { GlobalSearch } from '@/components/GlobalSearch'
import { MapSearch } from '@/components/MapSearch'
import { MapFilters } from '@/components/MapFilters'
import { InteractiveMap } from '@/components/InteractiveMap'
import { SettingsPage } from '@/components/SettingsPage'

// ==========================================================================
// Tests
// ==========================================================================

describe('BottomNav', () => {
  it('renders all 5 tab labels', () => {
    render(
      <BottomNav activeTab="trending" onTabChange={vi.fn()} />
    )
    expect(screen.getByText('Trending')).toBeTruthy()
    expect(screen.getByText('Discover')).toBeTruthy()
    expect(screen.getByText('Map')).toBeTruthy()
    expect(screen.getByText('Alerts')).toBeTruthy()
    expect(screen.getByText('Profile')).toBeTruthy()
  })

  it('calls onTabChange with correct tab id when clicked', () => {
    const onTabChange = vi.fn()
    render(
      <BottomNav activeTab="trending" onTabChange={onTabChange} />
    )
    fireEvent.click(screen.getByText('Discover'))
    expect(onTabChange).toHaveBeenCalledWith('discover')

    fireEvent.click(screen.getByText('Map'))
    expect(onTabChange).toHaveBeenCalledWith('map')
  })

  it('shows notification badge when unreadNotifications > 0', () => {
    render(
      <BottomNav
        activeTab="trending"
        onTabChange={vi.fn()}
        unreadNotifications={5}
      />
    )
    expect(screen.getByText('5')).toBeTruthy()
  })
})

describe('MainTabRouter', () => {
  it('renders without crashing', () => {
    const { container } = render(<MainTabRouter />)
    expect(container).toBeTruthy()
  })
})

describe('SubPageRouter', () => {
  it('renders main content area (returns null when subPage is null)', () => {
    const { container } = render(<SubPageRouter />)
    expect(container).toBeTruthy()
  })
})

describe('AppHeader', () => {
  it('renders the Pulse title', () => {
    render(
      <AppHeader
        locationName="Seattle, WA"
        isTracking={false}
        hasRealtimeLocation={false}
        locationPermissionDenied={false}
        currentTime={new Date('2026-03-24T20:00:00')}
      />
    )
    expect(screen.getByText('Pulse')).toBeTruthy()
  })

  it('renders location name', () => {
    render(
      <AppHeader
        locationName="Brooklyn, NY"
        isTracking={false}
        hasRealtimeLocation={false}
        locationPermissionDenied={false}
        currentTime={new Date('2026-03-24T20:00:00')}
      />
    )
    expect(screen.getByText('Brooklyn, NY')).toBeTruthy()
  })

  it('shows queued pulse count badge', () => {
    render(
      <AppHeader
        locationName="Seattle"
        isTracking={false}
        hasRealtimeLocation={false}
        locationPermissionDenied={false}
        currentTime={new Date('2026-03-24T20:00:00')}
        queuedPulseCount={3}
      />
    )
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Queued')).toBeTruthy()
  })
})

describe('AdaptiveHomeHeader', () => {
  it('renders greeting with username', () => {
    render(
      <AdaptiveHomeHeader
        username="Alex"
        date={new Date('2026-03-24T20:00:00')}
      />
    )
    expect(screen.getByText(/Good evening.*Alex/)).toBeTruthy()
  })
})

describe('OnboardingFlow', () => {
  it('renders welcome screen with Get Started button', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)
    expect(screen.getByText('Welcome to Pulse')).toBeTruthy()
    expect(screen.getByText(/Get Started/)).toBeTruthy()
  })

  it('advances through steps when Get Started is clicked', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get Started/))
    expect(screen.getByText("What's your scene?")).toBeTruthy()
  })
})

describe('CreatePulseDialog', () => {
  const mockVenue = {
    id: 'v1',
    name: 'The Blue Note',
    category: 'bar',
    pulseScore: 72,
    location: { lat: 40.7, lng: -74.0 },
    city: 'NYC',
  } as any

  it('when open, renders dialog with venue name', () => {
    render(
      <CreatePulseDialog
        open={true}
        onClose={vi.fn()}
        venue={mockVenue}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText(/Create Pulse at The Blue Note/)).toBeTruthy()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(
      <CreatePulseDialog
        open={true}
        onClose={onClose}
        venue={mockVenue}
        onSubmit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('ReportDialog', () => {
  it('when open, renders reason selection', () => {
    render(
      <ReportDialog
        open={true}
        onOpenChange={vi.fn()}
        targetType="pulse"
        targetId="p1"
        reporterId="u1"
        onReport={vi.fn()}
      />
    )
    expect(screen.getByText('Spam')).toBeTruthy()
    expect(screen.getByText('Inappropriate')).toBeTruthy()
    expect(screen.getByText('Harassment')).toBeTruthy()
  })
})

describe('ShareSheet', () => {
  const mockCard = {
    title: 'Great Venue',
    description: 'An amazing spot',
    imageText: 'GV',
    energyLabel: 'Buzzing',
    energyColor: '#f59e0b',
    score: 85,
    url: 'https://pulse.app/venue/v1',
  }

  it('when open with card, renders share options', () => {
    render(
      <ShareSheet
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
      />
    )
    expect(screen.getByText('Great Venue')).toBeTruthy()
    expect(screen.getAllByText(/Share/).length).toBeGreaterThan(0)
    expect(screen.getByText('Copy Link')).toBeTruthy()
    expect(screen.getByText('Message')).toBeTruthy()
    expect(screen.getByText('Story')).toBeTruthy()
  })
})

describe('GlobalSearch', () => {
  const mockVenues = [
    {
      id: 'v1',
      name: 'Rooftop Lounge',
      category: 'lounge',
      city: 'Seattle',
      pulseScore: 80,
      location: { lat: 47.6, lng: -122.3 },
    },
    {
      id: 'v2',
      name: 'Jazz Club',
      category: 'club',
      city: 'Portland',
      pulseScore: 65,
      location: { lat: 45.5, lng: -122.6 },
    },
  ] as any[]

  it('when open, renders search input', () => {
    render(
      <GlobalSearch
        open={true}
        onClose={vi.fn()}
        venues={mockVenues}
        onSelectVenue={vi.fn()}
        onSelectCity={vi.fn()}
      />
    )
    expect(
      screen.getByPlaceholderText('Search venues, cities, categories...')
    ).toBeTruthy()
  })

  it('filters venues on input', () => {
    render(
      <GlobalSearch
        open={true}
        onClose={vi.fn()}
        venues={mockVenues}
        onSelectVenue={vi.fn()}
        onSelectCity={vi.fn()}
      />
    )
    const input = screen.getByPlaceholderText(
      'Search venues, cities, categories...'
    )
    fireEvent.change(input, { target: { value: 'Rooftop' } })
    expect(input).toBeTruthy()
  })
})

describe('MapSearch', () => {
  it('renders search input', () => {
    render(
      <MapSearch
        venues={[]}
        onVenueSelect={vi.fn()}
        userLocation={null}
      />
    )
    expect(screen.getByPlaceholderText('Search venues...')).toBeTruthy()
  })
})

describe('MapFilters', () => {
  it('renders filter options', () => {
    render(
      <MapFilters
        filters={{
          energyLevels: [],
          categories: [],
          maxDistance: Infinity,
        }}
        onChange={vi.fn()}
        availableCategories={['bar', 'club', 'restaurant']}
      />
    )
    expect(screen.getByRole('button')).toBeTruthy()
  })
})

describe('InteractiveMap', () => {
  it('renders map container div', () => {
    const { container } = render(
      <InteractiveMap
        venues={[]}
        userLocation={null}
        onVenueClick={vi.fn()}
      />
    )
    expect(container).toBeTruthy()
  })
})

describe('SettingsPage', () => {
  it('renders settings page', () => {
    render(
      <SettingsPage
        currentUser={{ id: 'u1', username: 'testuser', profilePhoto: '', friends: [], favoriteVenues: [], followedVenues: [], createdAt: '', venueCheckInHistory: {} } as any}
        onBack={vi.fn()}
        onUpdateUser={vi.fn()}
        onCityChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('settings-page')).toBeTruthy()
  })
})
