// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, _prop) => {
      return ({ children, ...props }: any) => {
        const filteredProps: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(props)) {
          if (!['initial','animate','exit','transition','whileHover','whileTap','whileInView','whileDrag','drag','dragConstraints','dragElastic','layout','layoutId','variants','custom','onAnimationComplete','style','dragSnapToOrigin','onDragEnd','onPan','onPanEnd'].includes(key)) {
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
  useMotionValue: (v: number) => ({ get: () => v, set: () => {}, on: () => () => {} }),
  useDragControls: () => ({ start: () => {} }),
  useAnimation: () => ({ start: () => Promise.resolve(), stop: () => {} }),
  useInView: () => true,
}))

// Vitest resolves named exports via Object.keys() at mock-load time, so a
// Proxy alone is insufficient — we must enumerate every icon the components
// under test import. The list is inlined inside the factory because vi.mock
// factories are hoisted and cannot reference top-level variables.
vi.mock('@phosphor-icons/react', () => {
  const icons = [
    'ArrowClockwise','ArrowCounterClockwise','ArrowDown','ArrowLeft','ArrowRight','ArrowSquareOut','ArrowUp','ArrowsClockwise',
    'ArrowsLeftRight','BeerBottle','Bell','BellSimple','BookmarkSimple','Buildings','Calendar','CalendarBlank',
    'CalendarCheck','Camera','Car','CarProfile','CaretDown','CaretLeft','CaretRight','CaretUp',
    'ChartBar','ChartLine','ChatCircle','ChatText','Check','CheckCircle','CircleNotch','Clock',
    'ClockAfternoon','CloudRain','Coffee','Compass','Confetti','Copy','Crown','CurrencyDollar',
    'CursorClick','Diamond','DownloadSimple','Envelope','EnvelopeSimple','Export','Eye','EyeSlash',
    'Eyeglasses','Faders','Fire','Flag','Flame','Footprints','ForkKnife','FunnelSimple',
    'Gear','GearSix','Globe','Handshake','Hash','HashStraight','Heart','HeartStraight',
    'House','Info','InstagramLogo','Lightbulb','Lightning','Link','LinkSimple','ListChecks',
    'Lock','LockSimple','MagnifyingGlass','MapPin','MapPinArea','MapTrifold','Martini','Medal',
    'Megaphone','Microphone','MicrophoneSlash','Minus','Moon','MusicNote','MusicNotes','NavigationArrow',
    'NotePencil','PaintBrush','Palette','PaperPlaneRight','PaperPlaneTilt','Path','Pause','PencilSimple',
    'PersonSimpleWalk','Phone','Play','Plus','Pulse','QrCode','Question','Quotes',
    'Ruler','Scales','Share','ShareNetwork','Shield','ShieldCheck','ShieldWarning','Skull',
    'SlidersHorizontal','Snowflake','Sparkle','SpeakerSimpleHigh','SpeakerSimpleLow','SpeakerSimpleNone','Star','Storefront',
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

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
  SheetClose: ({ children }: any) => <button>{children}</button>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: any) => open ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: any) => <p>{children}</p>,
  DrawerClose: ({ children }: any) => <button>{children}</button>,
  DrawerFooter: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@/components/ui/slider', () => ({
  Slider: (props: any) => <input type="range" {...props} />,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: any) => <input type="checkbox" role="switch" {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AvatarImage: (props: any) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/PulseScore', () => ({
  PulseScore: ({ score }: any) => <span data-testid="pulse-score">{score}</span>,
}))

vi.mock('@/lib/pulse-engine', () => ({
  formatTimeAgo: (_d: string) => 'just now',
  calculateDistance: () => 1.5,
  getEnergyLabel: (score: number) => {
    if (score >= 80) return 'Electric'
    if (score >= 60) return 'Buzzing'
    if (score >= 40) return 'Lively'
    if (score >= 20) return 'Chill'
    return 'Quiet'
  },
}))

vi.mock('@/lib/live-intelligence', () => ({
  getVenueLiveData: () => ({
    venueId: 'venue-1',
    timestamp: new Date().toISOString(),
    crowdLevel: 65,
    waitTime: 10,
    coverCharge: 20,
    coverChargeNote: undefined,
    dressCode: 'smart-casual',
    musicGenre: 'House',
    nowPlaying: { track: 'Test Track', artist: 'Test Artist' },
    ageRange: { min: 21, max: 35, average: 28 },
    capacity: null,
    lastUpdated: new Date().toISOString(),
    confidence: {
      waitTime: 'high',
      coverCharge: 'medium',
      crowdLevel: 'high',
      nowPlaying: 'medium',
      dressCode: 'low',
      ageRange: 'low',
      musicGenre: 'medium',
    },
  }),
  getCityHeatmap: () => [],
}))

vi.mock('@/lib/presence-engine', () => ({
  applyJitter: (v: number) => String(v),
}))

vi.mock('@/lib/units', () => ({
  formatDistance: (d: number, _unit: string) => `${d.toFixed(1)} mi`,
}))

vi.mock('@/hooks/use-unit-preference', () => ({
  useUnitPreference: () => ({ unitSystem: 'imperial', setUnitSystem: () => {} }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// ── Factory helpers ──────────────────────────────────────────────────

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
    friends: [],
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

// ── Static imports (after mocks) ──────────────────────────────────────

import { VenueQuickActions } from '@/components/VenueQuickActions'
import { VenueEnergyTimeline } from '@/components/VenueEnergyTimeline'
import { VenueHeroCarousel } from '@/components/VenueHeroCarousel'
import { VenueLivePanel } from '@/components/VenueLivePanel'
import { VenueActivityStream } from '@/components/VenueActivityStream'
import { VenueCompareSheet } from '@/components/VenueCompareSheet'
import { VenueTimelapseGallery } from '@/components/VenueTimelapseGallery'
import { ParallaxVenueHero } from '@/components/ParallaxVenueHero'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { MapVenueSheet } from '@/components/MapVenueSheet'
import { PresenceSheet } from '@/components/PresenceSheet'
import { WhoIsHereRow } from '@/components/WhoIsHereRow'
import { QuickReportSheet } from '@/components/QuickReportSheet'
import LiveActivityToast from '@/components/LiveActivityToast'
import { CityHeatmap } from '@/components/CityHeatmap'

// ── 1. VenueQuickActions ─────────────────────────────────────────────

describe('VenueQuickActions', () => {
  it('renders action buttons', async () => {
    render(
      <VenueQuickActions
        venue={makeVenue()}
        onCheckIn={() => {}}
        onShare={() => {}}
        onDirections={() => {}}
        onSave={() => {}}
        isSaved={false}
      />
    )
    expect(screen.getByText('Check In')).toBeDefined()
    expect(screen.getByText('Share')).toBeDefined()
    expect(screen.getByText('Directions')).toBeDefined()
    expect(screen.getByText('Save')).toBeDefined()
  })

  it('calls onCheckIn when check-in button clicked', async () => {
    const onCheckIn = vi.fn()
    render(
      <VenueQuickActions
        venue={makeVenue()}
        onCheckIn={onCheckIn}
        onShare={() => {}}
        onDirections={() => {}}
        onSave={() => {}}
        isSaved={false}
      />
    )
    fireEvent.click(screen.getByText('Check In'))
    expect(onCheckIn).toHaveBeenCalledOnce()
  })
})

// ── 2. VenueEnergyTimeline ───────────────────────────────────────────

describe('VenueEnergyTimeline', () => {
  it('renders with SVG element and "Now" label', async () => {
    const { container } = render(
      <VenueEnergyTimeline venueId="venue-1" currentScore={75} />
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(screen.getByText('Now')).toBeDefined()
  })
})

// ── 3. VenueHeroCarousel ─────────────────────────────────────────────

describe('VenueHeroCarousel', () => {
  it('renders venue name', async () => {
    render(
      <VenueHeroCarousel
        venue={makeVenue()}
        pulseScore={75}
        onBack={() => {}}
      />
    )
    expect(screen.getByText('Test Venue')).toBeDefined()
  })

  it('calls onBack when back button clicked', async () => {
    const onBack = vi.fn()
    render(
      <VenueHeroCarousel
        venue={makeVenue()}
        pulseScore={75}
        onBack={onBack}
      />
    )
    // The back button contains the ArrowLeft icon
    const backButton = screen.getByTestId('icon-ArrowLeft').closest('button')
    expect(backButton).not.toBeNull()
    fireEvent.click(backButton!)
    expect(onBack).toHaveBeenCalledOnce()
  })
})

// ── 4. VenueLivePanel ────────────────────────────────────────────────

describe('VenueLivePanel', () => {
  it('renders live data fields', async () => {
    const liveData = {
      venueId: 'venue-1',
      timestamp: new Date().toISOString(),
      crowdLevel: 65,
      waitTime: 10,
      coverCharge: 20,
      coverChargeNote: undefined,
      dressCode: 'smart-casual' as const,
      musicGenre: 'House',
      nowPlaying: { track: 'Test Track', artist: 'Test Artist' },
      ageRange: { min: 21, max: 35, average: 28 },
      capacity: null,
      lastUpdated: new Date().toISOString(),
      confidence: {
        waitTime: 'high' as const,
        coverCharge: 'medium' as const,
        crowdLevel: 'high' as const,
        nowPlaying: 'medium' as const,
        dressCode: 'low' as const,
        ageRange: 'low' as const,
        musicGenre: 'medium' as const,
      },
    }
    render(
      <VenueLivePanel
        liveData={liveData}
        onReport={() => {}}
        onRefresh={() => {}}
      />
    )
    expect(screen.getByText('Live Intel')).toBeDefined()
    expect(screen.getByText('Wait')).toBeDefined()
    expect(screen.getByText('Cover')).toBeDefined()
    expect(screen.getByText('65% full')).toBeDefined()
  })
})

// ── 5. VenueActivityStream ───────────────────────────────────────────

describe('VenueActivityStream', () => {
  it('renders venue name in heading', async () => {
    render(
      <VenueActivityStream venueId="venue-1" venueName="Test Venue" />
    )
    expect(screen.getByText('Live Activity')).toBeDefined()
  })
})

// ── 6. VenueCompareSheet ─────────────────────────────────────────────

describe('VenueCompareSheet', () => {
  it('when open=true renders compare content with venue names', async () => {
    const venues = [
      makeVenue({ id: 'v1', name: 'Venue Alpha' }),
      makeVenue({ id: 'v2', name: 'Venue Beta', pulseScore: 60 }),
    ]
    render(
      <VenueCompareSheet
        open={true}
        onClose={() => {}}
        venues={venues}
        compareVenueIds={['v1', 'v2']}
        userLocation={{ lat: 40.7, lng: -74.0 }}
        unitSystem="imperial"
        onVenueClick={() => {}}
      />
    )
    expect(screen.getByText('Compare Venues')).toBeDefined()
    expect(screen.getByText('Venue Alpha')).toBeDefined()
    expect(screen.getByText('Venue Beta')).toBeDefined()
  })
})

// ── 7. VenueTimelapseGallery ─────────────────────────────────────────

describe('VenueTimelapseGallery', () => {
  it('renders time slots', async () => {
    const timelapse = [
      { timeOfDay: 'Morning', crowdLevel: 'sparse' as const, energyLabel: 'Chill', description: 'Quiet morning', color: '#22c55e' },
      { timeOfDay: 'Afternoon', crowdLevel: 'moderate' as const, energyLabel: 'Lively', description: 'Getting busy', color: '#eab308' },
      { timeOfDay: 'Night', crowdLevel: 'packed' as const, energyLabel: 'Electric', description: 'Peak hours', color: '#ef4444' },
    ]
    render(
      <VenueTimelapseGallery timelapse={timelapse} currentTimeOfDay="Night" />
    )
    expect(screen.getByText('Morning')).toBeDefined()
    expect(screen.getByText('Afternoon')).toBeDefined()
    expect(screen.getByText('Night')).toBeDefined()
  })
})

// ── 8. ParallaxVenueHero ─────────────────────────────────────────────

describe('ParallaxVenueHero', () => {
  it('renders venue name and category', async () => {
    render(
      <ParallaxVenueHero
        venue={makeVenue()}
        pulseScore={75}
        category="Bar"
      />
    )
    // venue.name appears in both collapsed header and main hero
    const nameElements = screen.getAllByText('Test Venue')
    expect(nameElements.length).toBeGreaterThan(0)
    const categoryElements = screen.getAllByText('Bar')
    expect(categoryElements.length).toBeGreaterThan(0)
  })
})

// ── 9. ScoreBreakdown ────────────────────────────────────────────────

describe('ScoreBreakdown', () => {
  it('renders breakdown info', async () => {
    const venue = makeVenue()
    const pulses = [makePulse()]
    render(
      <ScoreBreakdown venue={venue} pulses={pulses} />
    )
    expect(screen.getByText('Why this score?')).toBeDefined()
  })
})

// ── 10. MapVenueSheet ────────────────────────────────────────────────

describe('MapVenueSheet', () => {
  it('renders selected venue name', async () => {
    const venue = makeVenue({ name: 'Map Venue' })
    render(
      <MapVenueSheet
        venue={venue}
        venues={[venue]}
        userLocation={{ lat: 40.7, lng: -74.0 }}
        onClose={() => {}}
        onVenueClick={() => {}}
        onViewDetails={() => {}}
        calculateDistance={() => 1.5}
      />
    )
    expect(screen.getByText('Map Venue')).toBeDefined()
  })
})

// ── 11. PresenceSheet ────────────────────────────────────────────────

describe('PresenceSheet', () => {
  it('when open renders presence info', async () => {
    const presence = {
      venueId: 'venue-1',
      friendsHereNowCount: 3,
      friendsNearbyCount: 2,
      familiarFacesCount: 5,
      prioritizedAvatars: [],
      lastPresenceUpdateAt: new Date().toISOString(),
      isSuppressed: false,
    }
    const user = makeUser({
      presenceSettings: {
        enabled: true,
        visibility: 'everyone',
        hideAtSensitiveVenues: true,
      },
    })
    render(
      <PresenceSheet
        open={true}
        onClose={() => {}}
        presence={presence}
        currentUser={user}
        onUpdateSettings={() => {}}
      />
    )
    expect(screen.getByText("Who's Here Now")).toBeDefined()
    expect(screen.getByText('Friends Nearby')).toBeDefined()
    expect(screen.getByText('Familiar Faces')).toBeDefined()
  })
})

// ── 12. WhoIsHereRow ─────────────────────────────────────────────────

describe('WhoIsHereRow', () => {
  it('renders friend count text', async () => {
    const presence = {
      venueId: 'venue-1',
      friendsHereNowCount: 3,
      friendsNearbyCount: 2,
      familiarFacesCount: 0,
      prioritizedAvatars: [],
      lastPresenceUpdateAt: new Date().toISOString(),
      isSuppressed: false,
    }
    render(
      <WhoIsHereRow presence={presence} onClick={() => {}} />
    )
    // totalFriends = 3 + 2 = 5, applyJitter returns "5"
    expect(screen.getByText('5 friends here')).toBeDefined()
  })
})

// ── 13. QuickReportSheet ─────────────────────────────────────────────

describe('QuickReportSheet', () => {
  it('when open renders venue name and report fields', async () => {
    render(
      <QuickReportSheet
        open={true}
        onClose={() => {}}
        venueName="Test Venue"
        onSubmitWaitTime={() => {}}
        onSubmitCoverCharge={() => {}}
        onSubmitMusicGenre={() => {}}
        onSubmitCrowdLevel={() => {}}
        onSubmitDressCode={() => {}}
        onSubmitNowPlaying={() => {}}
      />
    )
    expect(screen.getByText('Report Live Intel')).toBeDefined()
    expect(screen.getByText(/Test Venue/)).toBeDefined()
    expect(screen.getByText('Wait Time')).toBeDefined()
    expect(screen.getByText('Cover')).toBeDefined()
    expect(screen.getByText('Crowd')).toBeDefined()
    expect(screen.getByText('Music')).toBeDefined()
    expect(screen.getByText('Dress Code')).toBeDefined()
  })
})

// ── 14. LiveActivityToast ────────────────────────────────────────────

describe('LiveActivityToast', () => {
  it('renders activity messages', async () => {
    const activities = [
      { id: 'a1', type: 'checkin' as const, message: 'Alice checked in', timestamp: Date.now() },
      { id: 'a2', type: 'trending' as const, message: 'Venue is trending', timestamp: Date.now() },
    ]
    render(
      <LiveActivityToast activities={activities} />
    )
    expect(screen.getByText('Alice checked in')).toBeDefined()
    expect(screen.getByText('Venue is trending')).toBeDefined()
  })
})

// ── 15. CityHeatmap ──────────────────────────────────────────────────

describe('CityHeatmap', () => {
  it('when visible renders heatmap container and close button', async () => {
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      scale: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    }) as any

    render(
      <CityHeatmap
        venues={[makeVenue()]}
        userLocation={{ lat: 40.7, lng: -74.0 }}
        onVenueClick={() => {}}
        visible={true}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('City Energy Map')).toBeDefined()
    // Close button contains X icon
    expect(screen.getByTestId('icon-X')).toBeDefined()
  })
})
