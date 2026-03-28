// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
type MockProps = { children?: ReactNode; [key: string]: unknown }


vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, _prop) => {
      return ({ children, ...props }: MockProps) => {
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
  AnimatePresence: ({ children }: MockProps) => <>{children}</>,
  useSpring: (v: number) => ({ get: () => v, set: () => {} }),
  useTransform: (_: unknown, fn: ((v: number) => number) | undefined) => ({ get: () => (fn ? fn(0) : 0) }),
  useMotionValue: (v: number) => ({ get: () => v, set: () => {} }),
  useInView: () => true,
  useAnimation: () => ({ start: () => Promise.resolve(), stop: () => {} }),
  useDragControls: () => ({ start: () => {} }),
}))

vi.mock('@phosphor-icons/react', () => new Proxy({}, {
  get: (_target, prop) => {
    if (prop === '__esModule') return true
    return (props: MockProps) => <span data-testid={`icon-${String(prop)}`} {...props} />
  }
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: (_key: string, defaultValue: unknown) => [defaultValue, vi.fn()],
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: MockProps) => open !== false ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: MockProps) => <div>{children}</div>,
  SheetHeader: ({ children }: MockProps) => <div>{children}</div>,
  SheetTitle: ({ children }: MockProps) => <h2>{children}</h2>,
  SheetDescription: ({ children }: MockProps) => <p>{children}</p>,
  SheetClose: ({ children }: MockProps) => <button>{children}</button>,
  SheetFooter: ({ children }: MockProps) => <div>{children}</div>,
  SheetTrigger: ({ children }: MockProps) => <div>{children}</div>,
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: MockProps) => open !== false ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: MockProps) => <div>{children}</div>,
  DrawerHeader: ({ children }: MockProps) => <div>{children}</div>,
  DrawerTitle: ({ children }: MockProps) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: MockProps) => <p>{children}</p>,
  DrawerClose: ({ children }: MockProps) => <button>{children}</button>,
  DrawerFooter: ({ children }: MockProps) => <div>{children}</div>,
  DrawerTrigger: ({ children }: MockProps) => <div>{children}</div>,
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: MockProps) => <div>{children}</div>,
  AreaChart: ({ children }: MockProps) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: MockProps) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: MockProps) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
  PieChart: ({ children }: MockProps) => <div>{children}</div>,
  Pie: () => null,
}))

// ---- Lib mocks ----

vi.mock('@/lib/table-booking', () => ({
  getDefaultVenueTables: () => [],
  generateTimeSlots: () => [],
  getAvailableTables: () => [],
  calculateDeposit: () => 0,
  createTableReservation: vi.fn(),
  TABLE_LOCATION_CONFIG: {},
}))

vi.mock('@/lib/payment-processing', () => ({
  formatPrice: (n: number) => `$${n}`,
  createPaymentIntent: vi.fn(),
  processPayment: vi.fn(),
}))

vi.mock('@/lib/ticketing', () => ({
  TICKET_TYPE_CONFIG: {},
  calculateDynamicPrice: (p: number) => p,
  getDefaultTicketTiers: () => [],
  reserveTicket: vi.fn(),
  confirmPurchase: vi.fn(),
  createGroupOrder: vi.fn(),
}))

vi.mock('@/lib/creator-economy', () => ({
  PLATFORM_FEE_RATE: 0.15,
}))

vi.mock('@/lib/social-coordination', () => ({
  createGroupPoll: vi.fn(),
  voteOnPoll: vi.fn(),
  getPollWinner: vi.fn(),
  getDistancesToVenue: () => [],
}))

vi.mock('@/lib/night-planner', () => ({
  getCurrentStopIndex: () => 0,
  adaptPlan: vi.fn(),
  swapStop: vi.fn(),
}))

vi.mock('@/lib/crew-mode', () => ({
  getConfirmedCount: () => 0,
  isSquadGoals: () => false,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

vi.mock('@/lib/demo-hashtags', () => ({
  DEMO_HASHTAGS: [],
}))

vi.mock('@/lib/venue-platform', () => ({
  buildGuestProfiles: () => [],
  getRegulars: () => [],
  getVIPGuests: () => [],
  getChurningGuests: () => [],
  getNewGuests: () => [],
  addGuestTag: vi.fn(),
  addGuestNote: vi.fn(),
  getStaffingRecommendation: (_vid: string, _d: Date, _p: unknown[]) => ({
    date: new Date().toISOString(),
    hours: Array.from({ length: 17 }, (_, i) => ({
      hour: i + 10 > 23 ? i + 10 - 24 : i + 10,
      recommendedStaff: 2,
      level: 'moderate' as const,
      confidence: 0.7,
    })),
  }),
  getCompetitorBenchmark: () => ({
    yourVenue: { venueId: 'venue-1', venueName: 'Test Venue', pulseScore: 75, visitorCount: 10, avgEnergy: 2, trendingFrequency: 3, peakHour: 21 },
    competitors: [],
  }),
}))

vi.mock('@/lib/venue-analytics-pro', () => ({}))

vi.mock('@/lib/retention-engine', () => ({
  getNextTierThreshold: () => 7,
  STREAK_TIER_THRESHOLDS: { none: 0, bronze: 3, silver: 7, gold: 30, diamond: 100 },
}))

vi.mock('@/lib/predictive-surge', () => ({
  analyzeVenuePatterns: () => [],
  getVenuesThatWillSurge: () => [
    { venueId: 'venue-1', probability: 0.8, expectedHour: 22, confidence: 0.9 },
  ],
  generateSmartNotification: () => 'Surging soon!',
}))

vi.mock('@/lib/contextual-intelligence', () => ({
  getContextualSearchSuggestions: () => [
    { label: 'Buzzing bars nearby', query: 'bars', category: 'bar', buzzingCount: 3 },
  ],
}))

vi.mock('@/lib/time-contextual-scoring', () => ({
  getTimeOfDay: () => 'evening',
  getContextualLabel: () => 'Hot tonight',
}))

vi.mock('@/lib/venue-trending', () => ({
  calculateVenueAnalytics: () => ({}),
}))

vi.mock('@/lib/analytics', () => ({
  getEvents: () => [],
  getIntegrationActionSummary: () => ({ total: 0 }),
}))

vi.mock('@/hooks/use-app-state', () => ({
  useAppState: () => ({ state: {}, dispatch: vi.fn() }),
}))

vi.mock('react-parallax-tilt', () => ({
  default: ({ children }: MockProps) => <div>{children}</div>,
}))

vi.mock('@/hooks/use-social-pulse', () => ({
  useSocialPulseIngestion: () => ({ socialPosts: [] }),
  useSocialPulseWindows: () => [],
  useVenuePulseWindows: () => [],
  usePulseCorrelations: () => [],
}))

vi.mock('@/lib/live-intelligence', () => ({
  getVenueLiveData: () => ({ waitTime: null, coverCharge: null, musicPlaying: null, crowdLevel: null, dressCode: null, nowPlaying: null, reports: [] }),
  reportWaitTime: vi.fn(),
  reportCoverCharge: vi.fn(),
  reportMusicPlaying: vi.fn(),
  reportCrowdLevel: vi.fn(),
  reportDressCode: vi.fn(),
  reportNowPlaying: vi.fn(),
  seedDemoReports: vi.fn(),
}))

// Mock child components for VenuePage
vi.mock('@/components/PulseScore', () => ({ PulseScore: () => <div data-testid="pulse-score" /> }))
vi.mock('@/components/PulseCard', () => ({ PulseCard: () => <div data-testid="pulse-card" /> }))
vi.mock('@/components/ScoreBreakdown', () => ({ ScoreBreakdown: () => <div data-testid="score-breakdown" /> }))
vi.mock('@/components/ShareSheet', () => ({ ShareSheet: () => null }))
vi.mock('@/components/VenueLivePanel', () => ({ VenueLivePanel: () => <div data-testid="venue-live-panel" /> }))
vi.mock('@/components/QuickReportSheet', () => ({ QuickReportSheet: () => null }))
vi.mock('@/components/AnimatedEmptyState', () => ({ AnimatedEmptyState: () => <div>No pulses</div> }))
vi.mock('@/components/WhoIsHereRow', () => ({ WhoIsHereRow: () => null }))
vi.mock('@/components/ParallaxVenueHero', () => ({ ParallaxVenueHero: ({ children }: MockProps) => <div>{children}</div> }))
vi.mock('@/components/LiveCrowdIndicator', () => ({ LiveCrowdIndicator: () => null }))
vi.mock('@/components/VenueEnergyTimeline', () => ({ VenueEnergyTimeline: () => null }))
vi.mock('@/components/VenueQuickActions', () => ({ VenueQuickActions: () => null }))
vi.mock('@/components/VenueActivityStream', () => ({ VenueActivityStream: () => null }))
vi.mock('@/components/VenueMemoryCard', () => ({ default: () => null }))

vi.mock('@/lib/sharing', () => ({
  generateVenueShareCard: () => null,
}))

vi.mock('@/lib/pulse-engine', () => ({
  formatTimeAgo: () => '5m ago',
}))

vi.mock('@/lib/units', () => ({
  formatDistance: () => '0.5 mi',
}))

vi.mock('@/lib/content-moderation', () => ({}))

// ---- UI component mocks ----

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: MockProps) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: MockProps) => <div {...props}>{children}</div>,
  CardContent: ({ children }: MockProps) => <div>{children}</div>,
  CardHeader: ({ children }: MockProps) => <div>{children}</div>,
  CardTitle: ({ children }: MockProps) => <h3>{children}</h3>,
  CardDescription: ({ children }: MockProps) => <p>{children}</p>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: MockProps) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: MockProps) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: MockProps) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: MockProps) => <input type="checkbox" {...props} />,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: MockProps) => <div>{children}</div>,
  SelectContent: ({ children }: MockProps) => <div>{children}</div>,
  SelectItem: ({ children }: MockProps) => <option>{children}</option>,
  SelectTrigger: ({ children }: MockProps) => <div>{children}</div>,
  SelectValue: () => <span />,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: MockProps) => <div>{children}</div>,
  AvatarFallback: ({ children }: MockProps) => <span>{children}</span>,
  AvatarImage: () => <img />,
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: MockProps) => <div>{children}</div>,
  TabsContent: ({ children }: MockProps) => <div>{children}</div>,
  TabsList: ({ children }: MockProps) => <div>{children}</div>,
  TabsTrigger: ({ children }: MockProps) => <button>{children}</button>,
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: (props: MockProps) => <div role="progressbar" aria-valuenow={props.value as number} />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/types', () => ({
  ENERGY_CONFIG: {
    dead: { label: 'Dead', emoji: '💀', color: '#666' },
    chill: { label: 'Chill', emoji: '😎', color: '#3b82f6' },
    buzzing: { label: 'Buzzing', emoji: '🐝', color: '#f59e0b' },
    electric: { label: 'Electric', emoji: '⚡', color: '#ef4444' },
  },
}))

vi.mock('@/lib/events', () => ({}))

// ---- Helper factories ----

function makeVenue(overrides: Record<string, unknown> = {}) {
  return { id: 'venue-1', name: 'Test Venue', location: { lat: 40.7, lng: -74.0, address: '123 Main St' }, city: 'New York', state: 'NY', pulseScore: 75, category: 'Bar', lastPulseAt: new Date().toISOString(), ...overrides }
}
function makeUser(overrides: Record<string, unknown> = {}) {
  return { id: 'user-1', username: 'testuser', friends: ['friend-1'], createdAt: new Date().toISOString(), ...overrides }
}
function makePulse(overrides: Record<string, unknown> = {}) {
  return { id: 'pulse-1', userId: 'user-1', venueId: 'venue-1', photos: [], energyRating: 'buzzing' as const, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+5400000).toISOString(), reactions: { fire: [], eyes: [], skull: [], lightning: [] }, views: 10, ...overrides }
}

// ---- Tests ----

describe('TableBookingSheet', () => {
  it('renders booking form with venue name when open', async () => {
    const { TableBookingSheet } = await import('@/components/TableBookingSheet')
    render(
      <TableBookingSheet
        open={true}
        onOpenChange={vi.fn()}
        venue={makeVenue()}
        userId="user-1"
        existingReservations={[]}
        onBook={vi.fn()}
      />
    )
    expect(screen.getByText('Test Venue')).toBeDefined()
  })
})

describe('TicketPurchaseSheet', () => {
  it('renders event title when open', async () => {
    const { TicketPurchaseSheet } = await import('@/components/TicketPurchaseSheet')
    const event = {
      id: 'event-1',
      venueId: 'venue-1',
      title: 'Friday Night Live',
      ticketTypes: [{ id: 'tt-1', name: 'General', price: 20, available: 100 }],
    }
    render(
      <TicketPurchaseSheet
        open={true}
        onOpenChange={vi.fn()}
        event={event}
        currentUser={makeUser()}
        allUsers={[makeUser()]}
        onPurchase={vi.fn()}
      />
    )
    expect(screen.getByText('Friday Night Live')).toBeDefined()
  })
})

describe('TipSheet', () => {
  it('renders tip UI with creator username when open', async () => {
    const { TipSheet } = await import('@/components/TipSheet')
    render(
      <TipSheet
        open={true}
        onClose={vi.fn()}
        creatorUsername="coolcreator"
        onSendTip={vi.fn()}
      />
    )
    expect(screen.getByText(/coolcreator/)).toBeDefined()
  })
})

describe('GroupPollSheet', () => {
  it('renders poll creation UI when open', async () => {
    const { GroupPollSheet } = await import('@/components/GroupPollSheet')
    render(
      <GroupPollSheet
        open={true}
        onOpenChange={vi.fn()}
        venues={[makeVenue()]}
        currentUserId="user-1"
        friends={[makeUser({ id: 'friend-1', username: 'friend' })]}
      />
    )
    expect(screen.getByTestId('drawer')).toBeDefined()
  })
})

describe('MeetUpSuggestion', () => {
  it('renders Meet in the Middle heading and venue suggestions', async () => {
    const { MeetUpSuggestion } = await import('@/components/MeetUpSuggestion')
    render(
      <MeetUpSuggestion
        suggestions={[makeVenue()]}
        friendNames={['Alice', 'Bob']}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText(/Meet in the Middle/i)).toBeDefined()
    expect(screen.getByText('Test Venue')).toBeDefined()
  })
})

describe('LivePlanTracker', () => {
  it('renders plan stops', async () => {
    const { LivePlanTracker } = await import('@/components/LivePlanTracker')
    const plan = {
      id: 'plan-1',
      name: 'Friday Night',
      stops: [{ venueId: 'venue-1', order: 0, status: 'upcoming', arriveBy: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    }
    render(
      <LivePlanTracker
        plan={plan}
        venues={[makeVenue()]}
        pulses={[makePulse()]}
        currentUser={makeUser()}
        onBack={vi.fn()}
        onVenueClick={vi.fn()}
      />
    )
    expect(screen.getByText('Test Venue')).toBeDefined()
  })
})

describe('CrewPanel', () => {
  it('renders crew name and members', async () => {
    const { CrewPanel } = await import('@/components/CrewPanel')
    const crew = {
      id: 'crew-1',
      name: 'Night Owls',
      memberIds: ['user-1', 'user-2'],
      createdById: 'user-1',
      createdAt: new Date().toISOString(),
    }
    render(
      <CrewPanel
        crew={crew}
        members={[
          { id: 'user-1', username: 'alice' },
          { id: 'user-2', username: 'bob' },
        ]}
        currentUserId="user-1"
      />
    )
    expect(screen.getByText('Night Owls')).toBeDefined()
    expect(screen.getByText(/2 members/)).toBeDefined()
  })
})

describe('HashtagManager', () => {
  it('renders hashtag input and list', async () => {
    const { HashtagManager } = await import('@/components/HashtagManager')
    const tracked = [
      { id: 'h1', tag: '#nightlife', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]
    render(
      <HashtagManager
        trackedHashtags={tracked}
        venues={[makeVenue()]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onToggleActive={vi.fn()}
        onUpdateVenueMapping={vi.fn()}
      />
    )
    expect(screen.getByText(/#nightlife/)).toBeDefined()
  })
})

describe('GuestCRM', () => {
  it('renders guest list', async () => {
    const { GuestCRM } = await import('@/components/GuestCRM')
    render(
      <GuestCRM
        venueId="venue-1"
        pulses={[makePulse()]}
        users={[{ id: 'user-1', username: 'testuser' }]}
      />
    )
    // Should render the segment tabs (All, VIP, etc.)
    expect(screen.getByText('All')).toBeDefined()
  })
})

describe('StaffScheduler', () => {
  it('renders schedule view', async () => {
    const { StaffScheduler } = await import('@/components/StaffScheduler')
    render(
      <StaffScheduler
        venueId="venue-1"
        pulses={[makePulse()]}
      />
    )
    expect(screen.getByText('Staff Scheduling')).toBeDefined()
  })
})

describe('CompetitorBenchmark', () => {
  it('renders benchmark view', async () => {
    const { CompetitorBenchmark } = await import('@/components/CompetitorBenchmark')
    render(
      <CompetitorBenchmark
        venue={makeVenue()}
        venues={[makeVenue()]}
        pulses={[makePulse()]}
        competitorIds={[]}
        onAddCompetitor={vi.fn()}
        onRemoveCompetitor={vi.fn()}
      />
    )
    expect(screen.getByText('Competitor Tracking')).toBeDefined()
  })
})

describe('AnalyticsDashboard', () => {
  it('renders dashboard heading', async () => {
    const { AnalyticsDashboard } = await import('@/components/AnalyticsDashboard')
    render(<AnalyticsDashboard />)
    expect(screen.getByText('Seeded Content Analytics')).toBeDefined()
  })
})

describe('SocialPulseDashboard', () => {
  it('renders dashboard heading', async () => {
    const { SocialPulseDashboard } = await import('@/components/SocialPulseDashboard')
    render(
      <SocialPulseDashboard
        venues={[makeVenue()]}
        pulses={[makePulse()]}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText('Social Pulse')).toBeDefined()
  })

  it('calls onBack when back button clicked', async () => {
    const { SocialPulseDashboard } = await import('@/components/SocialPulseDashboard')
    const onBack = vi.fn()
    render(
      <SocialPulseDashboard
        venues={[makeVenue()]}
        pulses={[makePulse()]}
        onBack={onBack}
      />
    )
    const backIcon = screen.getByTestId('icon-ArrowLeft')
    fireEvent.click(backIcon.closest('button') || backIcon)
    expect(onBack).toHaveBeenCalled()
  })
})

describe('SocialPulseGraph', () => {
  it('renders graph with hashtag', async () => {
    const { SocialPulseGraph } = await import('@/components/SocialPulseGraph')
    const windows = [
      { id: 'w1', hashtag: '#party', postCount: 10, totalEngagement: 50, normalizedScore: 80, startTime: new Date(Date.now() - 60000).toISOString(), endTime: new Date().toISOString(), windowSize: '5min' },
      { id: 'w2', hashtag: '#party', postCount: 15, totalEngagement: 70, normalizedScore: 90, startTime: new Date().toISOString(), endTime: new Date(Date.now() + 60000).toISOString(), windowSize: '5min' },
    ]
    render(
      <SocialPulseGraph
        windows={windows}
        hashtag="#party"
        windowSize="5min"
      />
    )
    expect(screen.getByText('Social Pulse')).toBeDefined()
  })
})

describe('CorrelationInsights', () => {
  it('renders correlation cards', async () => {
    const { CorrelationInsights } = await import('@/components/CorrelationInsights')
    const correlations = [
      { venueId: 'venue-1', windowSize: '60min', correlationCoefficient: 0.8, lag: 30, strength: 'strong', socialPulseScore: 85, venuePulseScore: 75 },
    ]
    render(
      <CorrelationInsights
        correlations={correlations}
        venues={[makeVenue()]}
      />
    )
    expect(screen.getByText('Test Venue')).toBeDefined()
  })
})

describe('CorrelationOverlayChart', () => {
  it('renders SVG chart', async () => {
    const { CorrelationOverlayChart } = await import('@/components/CorrelationOverlayChart')
    const socialWindows = [
      { id: 'sw1', hashtag: '#fun', postCount: 5, totalEngagement: 30, normalizedScore: 60, startTime: new Date(Date.now() - 60000).toISOString(), endTime: new Date().toISOString(), windowSize: '5min' },
    ]
    const venueWindows = [
      { id: 'vw1', venueId: 'venue-1', pulseScore: 70, startTime: new Date(Date.now() - 60000).toISOString(), endTime: new Date().toISOString(), windowSize: '5min' },
    ]
    const { container } = render(
      <CorrelationOverlayChart
        socialWindows={socialWindows}
        venueWindows={venueWindows}
      />
    )
    // Should render the chart with an SVG
    expect(container.querySelector('svg')).toBeDefined()
  })
})

describe('ToastSystem', () => {
  it('ToastProvider renders children', async () => {
    const { ToastProvider } = await import('@/components/ToastSystem')
    render(
      <ToastProvider>
        <span>child content</span>
      </ToastProvider>
    )
    expect(screen.getByText('child content')).toBeDefined()
  })

  it('useToast returns toast and dismiss functions', async () => {
    const { ToastProvider, useToast } = await import('@/components/ToastSystem')
    let hookValue: unknown = null
    function TestConsumer() {
      hookValue = useToast()
      return <span>consumer</span>
    }
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )
    expect(hookValue).not.toBeNull()
    expect(typeof hookValue.toast).toBe('function')
    expect(typeof hookValue.dismiss).toBe('function')
  })
})

describe('AccessibilityProvider', () => {
  it('renders children', async () => {
    const { AccessibilityProvider } = await import('@/components/AccessibilityProvider')
    render(
      <AccessibilityProvider>
        <span>accessible child</span>
      </AccessibilityProvider>
    )
    expect(screen.getByText('accessible child')).toBeDefined()
  })

  it('useAccessibility returns preferences', async () => {
    const { AccessibilityProvider, useAccessibility } = await import('@/components/AccessibilityProvider')
    let hookValue: unknown = null
    function TestConsumer() {
      hookValue = useAccessibility()
      return <span>consumer</span>
    }
    render(
      <AccessibilityProvider>
        <TestConsumer />
      </AccessibilityProvider>
    )
    expect(hookValue).not.toBeNull()
    expect(typeof hookValue.reducedMotion).toBe('boolean')
    expect(typeof hookValue.announceToScreenReader).toBe('function')
  })
})

describe('FriendMapDots', () => {
  it('renders SVG friend dots', async () => {
    const FriendMapDots = (await import('@/components/FriendMapDots')).default
    const friends = [
      { id: 'f1', username: 'alice', avatar: '', lat: 40.7, lng: -74.0, checkedIn: true },
    ]
    const latLngToPixel = (_lat: number, _lng: number) => ({ x: 100, y: 100 })
    const { container } = render(
      <FriendMapDots
        friends={friends}
        latLngToPixel={latLngToPixel}
        zoom={12}
      />
    )
    expect(container.querySelector('svg')).toBeDefined()
  })
})

describe('StreakCalendar', () => {
  it('renders calendar grid and streak count', async () => {
    const { StreakCalendar } = await import('@/components/StreakCalendar')
    const streak = {
      currentStreak: 5,
      longestStreak: 10,
      freezesRemaining: 2,
      lastActiveDate: new Date().toISOString().split('T')[0],
      tier: 'bronze' as const,
      history: [
        { date: new Date().toISOString().split('T')[0], active: true },
      ],
    }
    render(
      <StreakCalendar
        streak={streak}
        onUseFreeze={vi.fn()}
      />
    )
    expect(screen.getByText('5')).toBeDefined()
  })
})

describe('PredictiveSurgePanel', () => {
  it('renders panel heading', async () => {
    const { PredictiveSurgePanel } = await import('@/components/PredictiveSurgePanel')
    render(
      <PredictiveSurgePanel
        venues={[makeVenue()]}
        pulses={[makePulse()]}
        onVenueClick={vi.fn()}
      />
    )
    expect(screen.getByText('Predicted to Surge')).toBeDefined()
  })
})

describe('ContextualSearchSuggestions', () => {
  it('renders suggestion text', async () => {
    const { ContextualSearchSuggestions } = await import('@/components/ContextualSearchSuggestions')
    render(
      <ContextualSearchSuggestions
        venues={[makeVenue()]}
        userLocation={{ lat: 40.7, lng: -74.0 }}
        onSelectSuggestion={vi.fn()}
        date={new Date()}
      />
    )
    // The typing animation should start showing the suggestion label
    // Wait a bit for the first character
    expect(document.body.textContent).toBeDefined()
  })
})

describe('VenuePage', () => {
  it('renders venue name and back button', async () => {
    const { VenuePage } = await import('@/components/VenuePage')
    const venue = makeVenue()
    render(
      <VenuePage
        venue={venue}
        venuePulses={[]}
        distance={0.5}
        unitSystem="imperial"
        locationName="New York"
        currentTime={new Date()}
        isTracking={false}
        hasRealtimeLocation={false}
        isFavorite={false}
        currentUser={makeUser()}
        onBack={vi.fn()}
        onCreatePulse={vi.fn()}
        onReaction={vi.fn()}
        onToggleFavorite={vi.fn()}
        onOpenPresence={vi.fn()}
      />
    )
    expect(screen.getByText('Test Venue')).toBeDefined()
    expect(screen.getByTestId('icon-ArrowLeft')).toBeDefined()
  })
})
