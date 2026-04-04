// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, _prop) => {
      return ({ children, ...props }: any) => {
        const filteredProps: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(props)) {
          if (!['initial','animate','exit','transition','whileHover','whileTap','whileInView','whileDrag','drag','dragConstraints','dragElastic','layout','layoutId','variants','custom','onAnimationComplete','style'].includes(key)) {
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
    if (typeof prop === 'symbol' || prop === 'then') return undefined
    return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />
  },
  has: () => true,
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: (_key: string, defaultValue: any) => [defaultValue, vi.fn()],
}))

// ── Lib mocks ──────────────────────────────────────────────

vi.mock('@/lib/achievements', () => ({
  calculateAchievementProgress: () => [],
  getUnlockedAchievements: () => [],
  ACHIEVEMENTS: [],
  calculateCheckInStreak: () => 0,
}))

vi.mock('@/lib/events', () => ({
  getUpcomingEvents: () => [],
  getUserEvents: () => [],
  rsvpToEvent: (e: any) => e,
  predictEventSurge: () => null,
  getEventsSoon: () => [],
}))

vi.mock('@/lib/personal-insights', () => ({
  generateWeeklyInsights: () => ({
    userId: 'user-1',
    totalPulses: 0,
    uniqueVenues: 0,
    topVenues: [],
    favoriteTimeSlot: 'evening',
    energyContributed: {},
    weekStart: new Date().toISOString(),
    weekEnd: new Date().toISOString(),
  }),
  determineVibeType: () => ({ type: 'Explorer', emoji: '🧭', description: 'Test' }),
  generateActivityHeatmap: () => [],
  getInsightHighlights: () => [],
}))

vi.mock('@/lib/crew-mode', () => ({
  createCrew: () => ({}),
  getUserCrews: () => [],
  getActiveCrewCheckIns: () => [],
  initiateCrewCheckIn: () => ({}),
  confirmCrewCheckIn: () => ({}),
  buildCrewActivityFeed: () => [],
}))

vi.mock('@/lib/playlists', () => ({
  PRESET_MOODS: [],
  createPlaylist: () => ({}),
  togglePlaylistLike: () => ({}),
  getPlaylistsByMood: () => [],
  generatePlaylistCard: () => ({}),
  suggestMood: () => 'chill',
}))

vi.mock('@/lib/night-planner', () => ({
  generateNightPlan: () => ({ stops: [], totalEstimatedSpend: 0 }),
  getTotalEstimatedSpend: () => 0,
  PLANNER_VIBES: [],
  VENUE_TYPES: [],
}))

vi.mock('@/lib/content-moderation', () => ({
  REPORT_REASONS: ['spam', 'harassment', 'inappropriate'],
}))

vi.mock('@/lib/ticketing', () => ({
  TICKET_TYPE_CONFIG: {},
  getUpcomingTickets: () => [],
  getPastTickets: () => [],
  getRefundEligibility: () => ({ eligible: false }),
  requestRefund: () => ({}),
  applyRefund: () => ({}),
  initiateTransfer: () => ({}),
}))

vi.mock('@/lib/table-booking', () => ({
  TABLE_LOCATION_CONFIG: {},
  getUpcomingReservations: () => [],
  getPastReservations: () => [],
  cancelReservation: () => ({}),
}))

vi.mock('@/lib/payment-processing', () => ({
  formatPrice: (v: number) => `$${v}`,
}))

vi.mock('@/lib/neighborhood-scores', () => ({
  getNeighborhoodLeaderboard: () => [],
  getHottestNeighborhood: () => null,
  assignVenueToNeighborhood: () => null,
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: () => {},
}))

vi.mock('@/lib/creator-economy', () => ({
  getCreatorStats: () => ({ totalPulses: 0, totalReactions: 0, totalViews: 0 }),
  getCreatorTierProgress: () => ({ currentTier: 'bronze', nextTier: 'silver', progress: 0, requirements: {} }),
  buildCreatorProfile: () => ({}),
  CREATOR_TIER_REQUIREMENTS: {},
}))

vi.mock('@/lib/venue-challenges', () => ({
  getUserActiveChallenges: () => [],
  getChallengeTimeRemaining: () => 0,
}))

vi.mock('@/lib/brand-partnerships', () => ({
  getCreatorProposals: () => [],
  getActivePartnerships: () => [],
}))

vi.mock('@/lib/venue-owner', () => ({
  buildOwnerDashboard: () => ({
    venueId: 'v-1',
    venueName: 'Test Venue',
    currentScore: 80,
    pulsesLast24h: 5,
    pulsesLast7d: 20,
    uniqueVisitors7d: 15,
    peakHours: [],
    energyDistribution: { dead: 1, chill: 2, buzzing: 3, electric: 4 },
    topHashtags: [],
    averageEnergy: 2.0,
    trend: 'up' as const,
    scoreDelta: 5,
  }),
}))

vi.mock('@/lib/venue-analytics-pro', () => ({
  getCompetitorBenchmarks: () => [],
  getCustomerFlow: () => null,
  getTimingRecommendations: () => [],
}))

vi.mock('@/lib/venue-platform', () => ({
  PLAN_CONFIG: {
    free: { name: 'Free' },
    starter: { name: 'Starter' },
    pro: { name: 'Pro' },
    enterprise: { name: 'Enterprise' },
  },
  createPlatformAccount: () => ({
    id: 'acct-1',
    venueId: 'venue-1',
    plan: 'pro',
    team: [],
    createdAt: new Date().toISOString(),
  }),
  addTeamMember: () => ({}),
  removeTeamMember: () => ({}),
  isPlanFeatureAvailable: () => true,
  getRevenueMetrics: () => ({ revenue: 0, transactions: 0, averageOrder: 0 }),
  createCampaign: () => ({}),
  getCampaignROI: () => 0,
  getCampaignCTR: () => 0,
  generateSocialPost: () => ({ id: 'p1', content: 'post', platform: 'twitter' }),
}))

vi.mock('@/hooks/use-unit-preference', () => ({
  useUnitPreference: () => ({ setUnitSystem: vi.fn(), isImperial: true }),
}))

vi.mock('@/hooks/use-notification-settings', () => ({
  useNotificationSettings: () => ({
    settings: { pushEnabled: true, emailEnabled: false, friendActivity: true, venueAlerts: true, crewUpdates: true },
    updateSetting: vi.fn(),
  }),
}))

vi.mock('@/lib/us-venues', () => ({
  US_CITY_LOCATIONS: [],
}))

vi.mock('@/lib/offline-queue', () => ({
  getPendingCount: () => 0,
  clearQueue: vi.fn(),
  getLastQueueSyncStatus: () => null,
  getQueueRetryInfo: () => null,
}))

vi.mock('@/lib/i18n', () => ({
  getAvailableLocales: () => [{ code: 'en', name: 'English' }],
  getLocale: () => 'en',
  setLocale: vi.fn(),
}))

vi.mock('@/lib/accessibility', () => ({
  getHighContrastMode: () => 'off',
  setHighContrastMode: vi.fn(),
  prefersReducedMotion: () => false,
}))

vi.mock('@/lib/pwa', () => ({
  getInstallState: () => 'not-installed',
  showInstallPrompt: vi.fn(),
  listenForInstallPrompt: () => () => {},
}))

vi.mock('@/lib/social-graph', () => ({
  createFriendInviteLink: () => ({ url: 'https://example.com/invite' }),
  getPeopleYouMayKnow: () => [],
}))

vi.mock('@/lib/sharing', () => ({
  createReferralInvite: () => ({ inviteCode: 'ABC123' }),
}))

vi.mock('@/lib/stories', () => ({
  getActiveStories: () => [],
}))

vi.mock('@/lib/personalization-engine', () => ({}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  Cell: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
}))

// ── Child component mocks ──────────────────────────────────

vi.mock('@/components/AchievementBadge', () => ({
  AchievementBadge: () => <div data-testid="achievement-badge" />,
}))

vi.mock('@/components/StreakBadge', () => ({
  StreakBadge: () => <div data-testid="streak-badge" />,
}))

vi.mock('@/components/EventCard', () => ({
  EventCard: () => <div data-testid="event-card" />,
}))

vi.mock('@/components/CrewPanel', () => ({
  CrewPanel: () => <div data-testid="crew-panel" />,
}))

vi.mock('@/components/LivePlanTracker', () => ({
  LivePlanTracker: () => <div data-testid="live-plan-tracker" />,
}))

vi.mock('@/components/PulseCard', () => ({
  PulseCard: () => <div data-testid="pulse-card" />,
}))

vi.mock('@/components/PulseScore', () => ({
  PulseScore: () => <div data-testid="pulse-score" />,
}))

vi.mock('@/components/CreatorProfileBadge', () => ({
  CreatorProfileBadge: () => <div data-testid="creator-profile-badge" />,
}))

vi.mock('@/components/StoryRing', () => ({
  StoryRing: () => <div data-testid="story-ring" />,
}))

vi.mock('@/components/FriendSuggestions', () => ({
  FriendSuggestions: () => <div data-testid="friend-suggestions" />,
}))

vi.mock('@/components/PredictiveSurgePanel', () => ({
  PredictiveSurgePanel: () => <div data-testid="predictive-surge-panel" />,
}))

vi.mock('@/components/ForYouFeed', () => ({
  default: () => <div data-testid="for-you-feed" />,
}))

vi.mock('@/components/MoodSelector', () => ({
  default: () => <div data-testid="mood-selector" />,
}))

vi.mock('@/components/CompetitorBenchmark', () => ({
  CompetitorBenchmark: () => <div data-testid="competitor-benchmark" />,
}))

vi.mock('@/components/StaffScheduler', () => ({
  StaffScheduler: () => <div data-testid="staff-scheduler" />,
}))

vi.mock('@/components/GuestCRM', () => ({
  GuestCRM: () => <div data-testid="guest-crm" />,
}))

// ── Helper factories ───────────────────────────────────────

function makeVenue(overrides: any = {}) {
  return { id: 'venue-1', name: 'Test Venue', location: { lat: 40.7, lng: -74.0, address: '123 Main St' }, city: 'New York', state: 'NY', pulseScore: 75, category: 'Bar', lastPulseAt: new Date().toISOString(), ...overrides }
}
function makeUser(overrides: any = {}) {
  return { id: 'user-1', username: 'testuser', friends: ['friend-1'], createdAt: new Date().toISOString(), ...overrides }
}
function makePulse(overrides: any = {}) {
  return { id: 'pulse-1', userId: 'user-1', venueId: 'venue-1', photos: [], energyRating: 'buzzing' as const, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+5400000).toISOString(), reactions: { fire: [], eyes: [], skull: [], lightning: [] }, views: 10, ...overrides }
}
function makePulseWithUser(overrides: any = {}) {
  const pulse = makePulse(overrides)
  return { ...pulse, user: makeUser(), venue: makeVenue(), ...overrides }
}

// ── Imports (after mocks) ──────────────────────────────────

import { AchievementsPage } from '@/components/AchievementsPage'
import { EventsPage } from '@/components/EventsPage'
import { InsightsPage } from '@/components/InsightsPage'
import { CrewPage } from '@/components/CrewPage'
import { PlaylistsPage } from '@/components/PlaylistsPage'
import { NightPlannerPage } from '@/components/NightPlannerPage'
import { ModerationQueuePage } from '@/components/ModerationQueuePage'
import { MyTicketsPage } from '@/components/MyTicketsPage'
import { NeighborhoodView } from '@/components/NeighborhoodView'
import { SettingsPage } from '@/components/SettingsPage'
import { ProfileTab } from '@/components/ProfileTab'
import { DiscoverTab } from '@/components/DiscoverTab'
import { CreatorDashboard } from '@/components/CreatorDashboard'
import { VenueOwnerDashboard } from '@/components/VenueOwnerDashboard'
import { VenuePlatformDashboard } from '@/components/VenuePlatformDashboard'

// ── Tests ──────────────────────────────────────────────────

describe('AchievementsPage', () => {
  const defaultProps = {
    currentUser: makeUser(),
    pulses: [makePulse()],
    venues: [makeVenue()],
    crews: [],
    onBack: vi.fn(),
  }

  it('renders heading and back button', () => {
    render(<AchievementsPage {...defaultProps} />)
    expect(screen.getByText('Achievements')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<AchievementsPage {...defaultProps} onBack={onBack} />)
    const backButton = screen.getByText('Achievements').closest('div')!.parentElement!.querySelector('button')!
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalled()
  })
})

describe('EventsPage', () => {
  const defaultProps = {
    venues: [makeVenue()],
    events: [],
    currentUserId: 'user-1',
    onBack: vi.fn(),
    onEventUpdate: vi.fn(),
    onVenueClick: vi.fn(),
  }

  it('renders filter tabs', () => {
    render(<EventsPage {...defaultProps} />)
    expect(screen.getByText('Events')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Soon')).toBeInTheDocument()
    expect(screen.getByText('Mine')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<EventsPage {...defaultProps} onBack={onBack} />)
    const backButton = screen.getByText('Events').closest('div')!.parentElement!.querySelector('button')!
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalled()
  })
})

describe('InsightsPage', () => {
  const defaultProps = {
    currentUser: makeUser(),
    pulses: [makePulse()],
    venues: [makeVenue()],
    onBack: vi.fn(),
  }

  it('renders heading', () => {
    render(<InsightsPage {...defaultProps} />)
    expect(screen.getByText('Your Insights')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<InsightsPage {...defaultProps} onBack={onBack} />)
    const backButton = screen.getByText('Your Insights').closest('div')!.parentElement!.querySelector('button')!
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalled()
  })
})

describe('CrewPage', () => {
  const defaultProps = {
    currentUser: makeUser(),
    allUsers: [makeUser()],
    crews: [],
    crewCheckIns: [],
    venues: [makeVenue()],
    onBack: vi.fn(),
    onCrewsUpdate: vi.fn(),
    onCheckInsUpdate: vi.fn(),
  }

  it('renders heading', () => {
    render(<CrewPage {...defaultProps} />)
    expect(screen.getByText('Crews')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<CrewPage {...defaultProps} onBack={onBack} />)
    const backButton = screen.getByText('Crews').closest('div')!.parentElement!.querySelector('button')!
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalled()
  })
})

describe('PlaylistsPage', () => {
  const defaultProps = {
    currentUser: makeUser(),
    playlists: [],
    pulses: [makePulse()],
    venues: [makeVenue()],
    onBack: vi.fn(),
    onPlaylistsUpdate: vi.fn(),
  }

  it('renders heading', () => {
    render(<PlaylistsPage {...defaultProps} />)
    expect(screen.getByText('Playlists & Mood Boards')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<PlaylistsPage {...defaultProps} onBack={onBack} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onBack).toHaveBeenCalled()
  })
})

describe('NightPlannerPage', () => {
  const defaultProps = {
    currentUser: makeUser(),
    allUsers: [makeUser()],
    venues: [makeVenue()],
    pulses: [makePulse()],
    crews: [],
    userLocation: null,
    onBack: vi.fn(),
    onVenueClick: vi.fn(),
  }

  it('renders wizard heading', () => {
    render(<NightPlannerPage {...defaultProps} />)
    expect(screen.getByText('Night Planner')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<NightPlannerPage {...defaultProps} onBack={onBack} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onBack).toHaveBeenCalled()
  })
})

describe('ModerationQueuePage', () => {
  const defaultProps = {
    reports: [] as any[],
    onBack: vi.fn(),
    onUpdateReports: vi.fn(),
  }

  it('renders heading', () => {
    render(<ModerationQueuePage {...defaultProps} />)
    expect(screen.getByText('Moderation Queue')).toBeInTheDocument()
  })

  it('shows empty state with no reports', () => {
    render(<ModerationQueuePage {...defaultProps} />)
    expect(screen.getByText('No reports yet.')).toBeInTheDocument()
  })

  it('renders reports when provided', () => {
    const reports = [
      {
        id: 'r-1',
        reporterId: 'user-1',
        targetType: 'pulse' as const,
        targetId: 'pulse-1',
        reason: 'spam',
        description: 'Spam content',
        createdAt: new Date().toISOString(),
        status: 'pending' as const,
      },
    ]
    render(<ModerationQueuePage {...defaultProps} reports={reports} />)
    expect(screen.getByText(/PULSE/)).toBeInTheDocument()
  })
})

describe('MyTicketsPage', () => {
  const defaultProps = {
    currentUserId: 'user-1',
    tickets: [],
    reservations: [],
    events: [],
    venues: [makeVenue()],
    onBack: vi.fn(),
    onTicketsUpdate: vi.fn(),
    onReservationsUpdate: vi.fn(),
  }

  it('renders heading and tabs', () => {
    render(<MyTicketsPage {...defaultProps} />)
    expect(screen.getByText('My Tickets')).toBeInTheDocument()
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
    expect(screen.getByText('Past')).toBeInTheDocument()
  })
})

describe('NeighborhoodView', () => {
  const defaultProps = {
    venues: [makeVenue()],
    pulses: [makePulse()],
    onBack: vi.fn(),
    onVenueClick: vi.fn(),
  }

  it('renders heading', () => {
    render(<NeighborhoodView {...defaultProps} />)
    expect(screen.getByText('Neighborhoods')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<NeighborhoodView {...defaultProps} onBack={onBack} />)
    const backButton = screen.getByText('Neighborhoods').closest('div')!.parentElement!.querySelector('button')!
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalled()
  })
})

describe('SettingsPage', () => {
  const defaultProps = {
    currentUser: makeUser(),
    onBack: vi.fn(),
    onUpdateUser: vi.fn(),
    onCityChange: vi.fn(),
  }

  it('renders heading', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<SettingsPage {...defaultProps} onBack={onBack} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onBack).toHaveBeenCalled()
  })
})

describe('ProfileTab', () => {
  const defaultProps = {
    currentUser: makeUser(),
    pulses: [makePulse()],
    pulsesWithUsers: [makePulseWithUser()],
    favoriteVenues: [makeVenue()],
    onVenueClick: vi.fn(),
    onReaction: vi.fn(),
    onOpenSocialPulseDashboard: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenOwnerDashboard: vi.fn(),
    onOpenCreatorDashboard: vi.fn(),
    onOpenModerationQueue: vi.fn(),
  }

  it('renders username', () => {
    render(<ProfileTab {...defaultProps} />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('renders "Your Pulses" section', () => {
    render(<ProfileTab {...defaultProps} />)
    expect(screen.getByText('Your Pulses')).toBeInTheDocument()
  })
})

describe('DiscoverTab', () => {
  const defaultProps = {
    venues: [makeVenue()],
    pulses: [makePulse()],
    pulsesWithUsers: [makePulseWithUser()],
    currentUser: makeUser(),
    allUsers: [makeUser()],
    stories: [],
    events: [],
    userLocation: null,
    onVenueClick: vi.fn(),
    onStoryClick: vi.fn(),
    onAddFriend: vi.fn(),
    onNavigate: vi.fn(),
  }

  it('renders "Discover" heading', () => {
    render(<DiscoverTab {...defaultProps} />)
    expect(screen.getByText('Discover')).toBeInTheDocument()
  })
})

describe('CreatorDashboard', () => {
  const defaultProps = {
    currentUser: makeUser(),
    pulses: [makePulse()],
    venues: [makeVenue()],
    attributions: [],
    tipJar: null,
    challenges: [],
    partnerships: [],
    onBack: vi.fn(),
    onAcceptPartnership: vi.fn(),
    onDeclinePartnership: vi.fn(),
    onWithdrawTips: vi.fn(),
  }

  it('renders heading', () => {
    render(<CreatorDashboard {...defaultProps} />)
    expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<CreatorDashboard {...defaultProps} onBack={onBack} />)
    const backButton = screen.getByText('Creator Dashboard').closest('div')!.parentElement!.querySelector('button')!
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalled()
  })
})

describe('VenueOwnerDashboard', () => {
  const defaultProps = {
    dashboard: {
      venueId: 'venue-1',
      venueName: 'Test Venue',
      currentScore: 80,
      pulsesLast24h: 5,
      pulsesLast7d: 20,
      uniqueVisitors7d: 15,
      peakHours: [],
      energyDistribution: { dead: 1, chill: 2, buzzing: 3, electric: 4 },
      topHashtags: [],
      averageEnergy: 2.0,
      trend: 'up' as const,
      scoreDelta: 5,
    },
    announcements: [],
    onCreateAnnouncement: vi.fn(),
  }

  it('renders dashboard metrics', () => {
    render(<VenueOwnerDashboard {...defaultProps} />)
    expect(screen.getByText('Test Venue')).toBeInTheDocument()
    expect(screen.getByText('Owner Dashboard')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })
})

describe('VenuePlatformDashboard', () => {
  const defaultProps = {
    venue: makeVenue(),
    venues: [makeVenue()],
    pulses: [makePulse()],
    currentUserId: 'user-1',
    onBack: vi.fn(),
  }

  it('renders heading', () => {
    render(<VenuePlatformDashboard {...defaultProps} />)
    expect(screen.getByText('Venue Platform Dashboard')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<VenuePlatformDashboard {...defaultProps} onBack={onBack} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onBack).toHaveBeenCalled()
  })
})
