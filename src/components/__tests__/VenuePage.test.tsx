// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render as rtlRender, screen, type RenderOptions } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// VenuePage calls useLocation() and useQuery(); every render needs both a
// Router context and a QueryClient. A fresh client per render keeps tests
// isolated from each other's cache.
const render = (ui: React.ReactElement, options?: RenderOptions) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    ),
    ...options,
  })
}

vi.mock('framer-motion', () => {
  const strip = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {}
    const blocked = new Set(['initial','animate','exit','transition','whileHover','whileTap','whileInView','variants','layout','layoutId','style'])
    for (const [k, v] of Object.entries(props)) {
      if (blocked.has(k)) continue
      if (typeof v === 'function' && !k.startsWith('on')) continue
      filtered[k] = v
    }
    return filtered
  }
  return {
    motion: {
      div: ({ children, ...p }: any) => <div {...strip(p)}>{children}</div>,
      button: ({ children, ...p }: any) => <button {...strip(p)}>{children}</button>,
      span: ({ children, ...p }: any) => <span {...strip(p)}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useSpring: (v: number) => ({ get: () => v, set: () => {} }),
    useTransform: () => ({ get: () => 0 }),
    useMotionValue: (v: number) => ({ get: () => v, set: () => {} }),
    useScroll: () => ({ scrollY: { get: () => 0 } }),
    useInView: () => true,
  }
})

// Vitest resolves named exports via Object.keys() at mock-load time, so a
// Proxy alone is insufficient — we must enumerate every icon the components
// under test import. The list is inlined inside the factory because vi.mock
// factories are hoisted and cannot reference top-level variables.
vi.mock('@phosphor-icons/react', () => {
  const icons = [
    'ArrowClockwise','ArrowCounterClockwise','ArrowDown','ArrowLeft','ArrowRight','ArrowSquareOut','ArrowUp','ArrowsClockwise',
    'ArrowsLeftRight','BeerBottle','Bell','BellSimple','BookmarkSimple','Broadcast','Buildings','Calendar','CalendarBlank',
    'CalendarCheck','Camera','Car','CarProfile','CaretDown','CaretLeft','CaretRight','CaretUp',
    'ChartBar','ChartLine','ChatCircle','ChatCircleDots','ChatText','Check','CheckCircle','CircleNotch','Clock',
    'ClockAfternoon','CloudRain','Coffee','Compass','Confetti','Copy','Crown','CurrencyDollar',
    'CursorClick','Diamond','Disc','DownloadSimple','Envelope','EnvelopeSimple','Export','Eye','EyeSlash',
    'Eyeglasses','Faders','Fire','Flag','Flame','Footprints','ForkKnife','FunnelSimple',
    'Gear','GearSix','Globe','Handshake','Hash','HashStraight','Heart','HeartStraight',
    'House','Info','InstagramLogo','Lightbulb','Lightning','Link','LinkSimple','ListChecks',
    'Lock','LockSimple','MagnifyingGlass','MapPin','MapPinArea','MapTrifold','Martini','Medal',
    'Megaphone','Microphone','MicrophoneSlash','Minus','Moon','MusicNote','MusicNotes','NavigationArrow',
    'NotePencil','PaintBrush','Palette','PaperPlaneRight','PaperPlaneTilt','Path','Pause','PencilSimple',
    'PersonSimpleWalk','Phone','Play','Plus','Pulse','QrCode','Question','Queue','Quotes',
    'Ruler','Scales','SealCheck','Share','ShareNetwork','Shield','ShieldCheck','ShieldWarning','Skull',
    'SlidersHorizontal','Snowflake','Sparkle','SpeakerSimpleHigh','SpeakerSimpleLow','SpeakerSimpleNone','Stack','Star','Storefront',
    'Sun','TShirt','Tag','ThermometerHot','Ticket','Timer','Translate','Trash',
    'TrendDown','TrendUp','Trophy','User','UserCircle','UserPlus','Users','UsersFour',
    'UsersThree','VideoCamera','Warning','WarningCircle','WifiHigh','WifiSlash','Wrench','X',
  ]
  const exports: Record<string, any> = {}
  for (const name of icons) {
    exports[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return exports
})

vi.mock('@github/spark/hooks', () => ({
  useKV: (_k: string, defaultValue: any) => [defaultValue, vi.fn()],
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn() },
}))

// ── Lib mocks ──────────────────────────────────────────────────
vi.mock('@/lib/units', () => ({ formatDistance: () => '0.5 mi' }))
vi.mock('@/lib/pulse-engine', () => ({
  formatTimeAgo: () => '5m ago',
  getEnergyLabel: () => 'Buzzing',
  getEnergyColor: () => '#ff00ff',
  calculateDistance: () => 1,
}))
vi.mock('@/lib/time-contextual-scoring', () => ({
  getContextualLabel: () => 'Peak hour',
  getTimeOfDay: () => 'evening',
  getPeakConfig: () => ({}),
  normalizeCategoryKeyPublic: (c: string) => c,
}))
vi.mock('@/lib/sharing', () => ({
  generateVenueShareCard: () => ({ title: 'Share', description: 'desc' }),
  getPulseDeepLink: () => 'https://pulse.app/p/1',
}))
vi.mock('@/lib/live-intelligence', () => ({
  getVenueLiveData: () => null,
  getVenueLiveDataFromReports: () => null,
  addLocalLiveReport: vi.fn(),
  createLiveReport: vi.fn(() => ({})),
  seedDemoReports: vi.fn(),
  reportWaitTime: vi.fn(),
  reportCoverCharge: vi.fn(),
  reportMusicPlaying: vi.fn(),
  reportCrowdLevel: vi.fn(),
  reportDressCode: vi.fn(),
  reportNowPlaying: vi.fn(),
}))
vi.mock('@/lib/content-moderation', () => ({
  REPORT_REASONS: ['spam', 'harassment'],
}))
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))
vi.mock('@/lib/credibility', () => ({ getUserTrustBadges: () => [] }))
vi.mock('@/lib/supabase-api', () => ({
  fetchVenueLiveReportsFromSupabase: vi.fn().mockResolvedValue([]),
  submitVenueLiveReportToSupabase: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/hooks/use-unit-preference', () => ({
  useUnitPreference: () => ({ unitSystem: 'imperial' }),
}))
vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ triggerLight: vi.fn(), triggerMedium: vi.fn(), triggerHeavy: vi.fn() }),
}))

// ── Child component mocks ─────────────────────────────────────
vi.mock('@/components/PulseScore', () => ({
  PulseScore: ({ score }: any) => <span data-testid="pulse-score">{score}</span>,
}))
vi.mock('@/components/PulseCard', () => ({
  PulseCard: ({ pulse, onReaction }: any) => (
    <div data-testid={`pulse-card-${pulse.id}`}>
      <button onClick={() => onReaction('fire')}>React Fire</button>
    </div>
  ),
}))
vi.mock('@/components/ScoreBreakdown', () => ({
  ScoreBreakdown: () => <div data-testid="score-breakdown" />,
}))
vi.mock('@/components/ShareSheet', () => ({
  ShareSheet: ({ open }: any) => (open ? <div data-testid="share-sheet" /> : null),
}))
vi.mock('@/components/VenueLivePanel', () => ({
  VenueLivePanel: () => <div data-testid="venue-live-panel" />,
}))
vi.mock('@/components/QuickReportSheet', () => ({
  QuickReportSheet: ({ open }: any) => (open ? <div data-testid="report-sheet" /> : null),
}))
vi.mock('@/components/ParallaxVenueHero', () => ({
  ParallaxVenueHero: () => <div data-testid="parallax-hero" />,
}))
vi.mock('@/components/AnimatedEmptyState', () => ({
  AnimatedEmptyState: ({ onAction, actionLabel }: any) => (
    <div data-testid="empty-state">
      <button onClick={onAction}>{actionLabel}</button>
    </div>
  ),
}))
vi.mock('@/components/WhoIsHereRow', () => ({
  WhoIsHereRow: ({ onClick }: any) => (
    <button data-testid="who-here" onClick={onClick}>Who's Here</button>
  ),
}))
vi.mock('@/components/LiveCrowdIndicator', () => ({
  LiveCrowdIndicator: () => <div data-testid="live-crowd" />,
}))
vi.mock('@/components/VenueEnergyTimeline', () => ({
  VenueEnergyTimeline: () => <div data-testid="energy-timeline" />,
}))
vi.mock('@/components/VenueQuickActions', () => ({
  VenueQuickActions: ({ onCheckIn, onShare, onSave }: any) => (
    <div data-testid="quick-actions">
      <button onClick={onCheckIn}>Quick Check In</button>
      <button onClick={onShare}>Quick Share</button>
      <button onClick={onSave}>Quick Save</button>
    </div>
  ),
}))
vi.mock('@/components/VenueMemoryCard', () => ({
  default: () => <div data-testid="venue-memory" />,
}))

// ── Imports after mocks ───────────────────────────────────────
import { VenuePage } from '@/components/VenuePage'
import type { Venue, PulseWithUser, User } from '@/lib/types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    pulseScore: 65,
    category: 'Bar',
    ...overrides,
  }
}
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'alice',
    friends: [],
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}
function makePulse(overrides: Partial<PulseWithUser> = {}): PulseWithUser {
  const v = makeVenue()
  const u = makeUser()
  return {
    id: 'pulse-1',
    userId: u.id,
    venueId: v.id,
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    user: u,
    venue: v,
    ...overrides,
  }
}

const baseProps = () => ({
  venue: makeVenue(),
  venuePulses: [] as PulseWithUser[],
  distance: 1.2,
  unitSystem: 'imperial' as const,
  locationName: 'Manhattan',
  currentTime: new Date('2025-02-14T20:00:00Z'),
  isTracking: false,
  hasRealtimeLocation: false,
  isFavorite: false,
  currentUser: makeUser(),
  onBack: vi.fn(),
  onCreatePulse: vi.fn(),
  onReaction: vi.fn(),
  onToggleFavorite: vi.fn(),
  onOpenPresence: vi.fn(),
})

describe('VenuePage', () => {
  it('renders the venue name and details', () => {
    render(<VenuePage {...baseProps()} />)
    // The venue name appears as a heading in both the hero and collapsed header.
    expect(screen.getAllByRole('heading', { name: /Test Venue/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/123 Main St/).length).toBeGreaterThan(0)
  })

  it('shows the Create Pulse CTA', () => {
    render(<VenuePage {...baseProps()} />)
    expect(screen.getAllByRole('button', { name: /Create Pulse/ }).length).toBeGreaterThan(0)
  })

  it('calls onCreatePulse when Create Pulse is clicked', () => {
    const onCreatePulse = vi.fn()
    render(<VenuePage {...baseProps()} onCreatePulse={onCreatePulse} />)
    const buttons = screen.getAllByRole('button', { name: /Create Pulse/ })
    fireEvent.click(buttons[0])
    expect(onCreatePulse).toHaveBeenCalled()
  })

  it('renders empty state when no pulses', () => {
    render(<VenuePage {...baseProps()} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('renders pulse cards when pulses exist', () => {
    const pulses = [makePulse({ id: 'p-1' }), makePulse({ id: 'p-2' })]
    render(<VenuePage {...baseProps()} venuePulses={pulses} />)
    expect(screen.getByTestId('pulse-card-p-1')).toBeInTheDocument()
    expect(screen.getByTestId('pulse-card-p-2')).toBeInTheDocument()
  })

  it('reaction flow dispatches onReaction with pulse id and type', () => {
    const onReaction = vi.fn()
    const pulses = [makePulse({ id: 'p-react' })]
    render(<VenuePage {...baseProps()} venuePulses={pulses} onReaction={onReaction} />)
    fireEvent.click(screen.getAllByText('React Fire')[0])
    expect(onReaction).toHaveBeenCalledWith('p-react', 'fire')
  })

  it('check-in/create pulse still renders without currentUser (auth-gated reporting)', () => {
    render(<VenuePage {...baseProps()} currentUser={null} />)
    expect(screen.getAllByRole('button', { name: /Create Pulse/ }).length).toBeGreaterThan(0)
    // Venue memory card should NOT render when there is no user
    expect(screen.queryByTestId('venue-memory')).not.toBeInTheDocument()
  })

  it('shows Venue Memory Card when currentUser provided', () => {
    render(<VenuePage {...baseProps()} />)
    expect(screen.getByTestId('venue-memory')).toBeInTheDocument()
  })

  it('Back button calls onBack', () => {
    const onBack = vi.fn()
    render(<VenuePage {...baseProps()} onBack={onBack} />)
    // ArrowLeft button is the first button in the header
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onBack).toHaveBeenCalled()
  })

  it('toggle favorite calls onToggleFavorite', () => {
    const onToggleFavorite = vi.fn()
    render(<VenuePage {...baseProps()} onToggleFavorite={onToggleFavorite} />)
    // The quick-actions mock includes a Quick Save button wired to onToggleFavorite
    fireEvent.click(screen.getByText('Quick Save'))
    expect(onToggleFavorite).toHaveBeenCalled()
  })

  it('renders "Check In With Crew" only when onStartCrewCheckIn is provided', () => {
    const { rerender } = render(<VenuePage {...baseProps()} />)
    expect(screen.queryByText(/Check In With Crew/)).not.toBeInTheDocument()

    rerender(<VenuePage {...baseProps()} onStartCrewCheckIn={vi.fn()} />)
    expect(screen.getByText(/Check In With Crew/)).toBeInTheDocument()
  })
})
