// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      return ({ children, ...props }: any) => {
        const tag = typeof prop === 'string' ? prop : 'div'
        const Component = tag as any
        const filteredProps: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(props)) {
          if (typeof value !== 'function' || key.startsWith('on')) {
            if (!['initial','animate','exit','transition','whileHover','whileTap','whileInView','whileDrag','drag','dragConstraints','dragElastic','layout','layoutId','variants','custom'].includes(key)) {
              filteredProps[key] = value
            }
          }
        }
        return <Component {...filteredProps}>{children}</Component>
      }
    }
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useSpring: (v: number) => ({ get: () => v, set: () => {} }),
  useTransform: (_: any, fn: any) => ({ get: () => (fn ? fn(0) : 0), set: () => {}, on: () => () => {} }),
  useMotionValue: (v: number) => ({ get: () => v, set: () => {} }),
  useInView: () => true,
  useScroll: () => ({ scrollY: { get: () => 0, set: () => {} }, scrollYProgress: { get: () => 0, set: () => {} } }),
}))

vi.mock('@phosphor-icons/react', () => new Proxy({}, {
  get: (_target, prop) => {
    if (prop === '__esModule') return true
    return ({ size, ...props }: any) => <span data-testid={`icon-${String(prop)}`} {...props} />
  }
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: any) => <div className={className}>{children}</div>,
  AvatarImage: ({ src }: any) => <img src={src} alt="" />,
  AvatarFallback: ({ children, className }: any) => <span className={className}>{children}</span>,
}))

vi.mock('@/lib/pulse-engine', () => ({
  getEnergyColor: () => '#ff0000',
  getEnergyLabel: () => 'Buzzing',
}))

vi.mock('@/lib/contextual-intelligence', () => ({
  getTimeContextualLabel: () => 'Happy Hour',
  getWeatherVenueTag: () => ({ type: 'indoor', weatherSafe: true, label: 'Indoor' }),
}))

vi.mock('@/lib/time-contextual-scoring', () => ({
  getTimeOfDay: () => 'evening',
  getDayType: () => 'weekday',
}))

vi.mock('@/lib/social-coordination', () => ({
  getSocialProofForVenue: () => ({ friendVisitsThisWeek: 3, isFavoriteInCircle: false, trendingInCircle: false, label: '3 friends visited' }),
}))

vi.mock('@/lib/creator-economy', () => ({
  CREATOR_TIERS: { rising: { label: 'Rising' }, verified: { label: 'Verified' }, elite: { label: 'Elite' } },
}))

vi.mock('@/lib/retention-engine', () => ({
  MILESTONE_CONFIGS: {
    '10th_checkin': { type: '10th_checkin', title: 'Double Digits!', description: 'You checked in 10 times.', icon: 'trophy' },
    'first_crew_night': { type: 'first_crew_night', title: 'Crew Night!', description: 'First time out with friends.', icon: 'users' },
    'new_neighborhood': { type: 'new_neighborhood', title: 'Explorer!', description: 'You visited a new neighborhood.', icon: 'map' },
    '50_pulses': { type: '50_pulses', title: 'Pulse Master!', description: '50 pulses dropped.', icon: 'lightning' },
    'week_streak': { type: 'week_streak', title: 'On Fire!', description: 'A full week streak.', icon: 'fire' },
  },
}))

vi.mock('@/lib/performance-engine', () => ({
  generateBlurhash: () => 'linear-gradient(135deg, #333 0%, #222 100%)',
}))

vi.mock('@/lib/venue-storytelling', () => ({
  // types only, no runtime exports needed
}))

vi.mock('@/lib/personalization-engine', () => ({
  // types only
}))

vi.mock('@/lib/types', () => ({
  ENERGY_CONFIG: {
    dead: { label: 'Dead', value: 0, color: '#666', emoji: '💀' },
    chill: { label: 'Chill', value: 1, color: '#0f0', emoji: '😌' },
    buzzing: { label: 'Buzzing', value: 2, color: '#ff0', emoji: '🔥' },
    electric: { label: 'Electric', value: 3, color: '#f0f', emoji: '⚡' },
  },
}))

vi.mock('@/lib/haptics', () => ({
  triggerEnergyChangeHaptic: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeVenue = (overrides: Record<string, any> = {}) => ({
  id: 'v1',
  name: 'Test Venue',
  location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
  pulseScore: 75,
  category: 'bar',
  ...overrides,
})

// ---------------------------------------------------------------------------
// 1. AnimatedEmptyState (consolidated from EmptyState + AnimatedEmptyState)
// ---------------------------------------------------------------------------

describe('AnimatedEmptyState', () => {
  let AnimatedEmptyState: any
  beforeEach(async () => {
    const mod = await import('@/components/AnimatedEmptyState')
    AnimatedEmptyState = mod.AnimatedEmptyState
  })

  it.each([
    ['no-venues', 'No venues nearby'],
    ['no-nearby', 'No venues nearby'],
    ['no-notifications', 'All caught up!'],
    ['no-favorites', 'No favorites yet'],
    ['no-pulses', 'No pulses yet'],
    ['no-results', 'Nothing found'],
    ['offline', "You're offline"],
  ] as const)('renders variant "%s"', (variant, expectedTitle) => {
    render(<AnimatedEmptyState variant={variant} />)
    expect(screen.getByText(expectedTitle)).toBeDefined()
  })

  it('renders action button when onAction is provided', () => {
    const onAction = vi.fn()
    render(<AnimatedEmptyState variant="no-venues" onAction={onAction} actionLabel="Go" />)
    expect(screen.getByText('Go')).toBeDefined()
  })

  it('shows default CTA label when onAction provided for "no-pulses"', () => {
    const onAction = vi.fn()
    render(<AnimatedEmptyState variant="no-pulses" onAction={onAction} />)
    expect(screen.getByText('Drop a Pulse')).toBeDefined()
  })

  it('shows default CTA label when onAction provided for "no-favorites"', () => {
    const onAction = vi.fn()
    render(<AnimatedEmptyState variant="no-favorites" onAction={onAction} />)
    expect(screen.getByText('Discover Venues')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 3. PulseScore
// ---------------------------------------------------------------------------

describe('PulseScore', () => {
  let PulseScore: any
  beforeEach(async () => {
    const mod = await import('@/components/PulseScore')
    PulseScore = mod.PulseScore
  })

  it('renders label when showLabel is true', () => {
    render(<PulseScore score={85} showLabel={true} />)
    expect(screen.getByText('Buzzing')).toBeDefined()
  })

  it('hides label when showLabel is false', () => {
    render(<PulseScore score={85} showLabel={false} />)
    expect(screen.queryByText('Buzzing')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. StreakBadge
// ---------------------------------------------------------------------------

describe('StreakBadge', () => {
  let StreakBadge: any
  let FirstPulseCelebration: any
  beforeEach(async () => {
    const mod = await import('@/components/StreakBadge')
    StreakBadge = mod.StreakBadge
    FirstPulseCelebration = mod.FirstPulseCelebration
  })

  it('returns null when streak < 1', () => {
    const { container } = render(<StreakBadge streak={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders streak count when streak >= 1', () => {
    render(<StreakBadge streak={5} />)
    expect(screen.getByText('5')).toBeDefined()
    expect(screen.getByText('day streak')).toBeDefined()
  })

  it('renders FirstPulseCelebration with venue name', () => {
    render(<FirstPulseCelebration venueName="Cool Bar" />)
    expect(screen.getByText('Cool Bar')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 5. GPSIndicator
// ---------------------------------------------------------------------------

describe('GPSIndicator', () => {
  let GPSIndicator: any
  beforeEach(async () => {
    const mod = await import('@/components/GPSIndicator')
    GPSIndicator = mod.GPSIndicator
  })

  it('shows LIVE when tracking', () => {
    render(<GPSIndicator isTracking={true} />)
    expect(screen.getByText('LIVE')).toBeDefined()
  })

  it('returns null when not tracking', () => {
    const { container } = render(<GPSIndicator isTracking={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows accuracy when provided', () => {
    render(<GPSIndicator isTracking={true} accuracy={12.345} />)
    expect(screen.getByText('±12m')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 6. OfflineBanner
// ---------------------------------------------------------------------------

describe('OfflineBanner', () => {
  let OfflineBanner: any
  const originalOnLine = navigator.onLine

  beforeEach(async () => {
    const mod = await import('@/components/OfflineBanner')
    OfflineBanner = mod.OfflineBanner
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true })
  })

  it('shows banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
    render(<OfflineBanner />)
    expect(screen.getByText(/offline/i)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 7. TimeContextualLabel
// ---------------------------------------------------------------------------

describe('TimeContextualLabel', () => {
  let TimeContextualLabel: any
  beforeEach(async () => {
    const mod = await import('@/components/TimeContextualLabel')
    TimeContextualLabel = mod.TimeContextualLabel
  })

  it('renders the label', () => {
    render(<TimeContextualLabel venue={makeVenue()} />)
    expect(screen.getByText('Happy Hour')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 8. WeatherAwareTag
// ---------------------------------------------------------------------------

describe('WeatherAwareTag', () => {
  let WeatherAwareTag: any
  beforeEach(async () => {
    const mod = await import('@/components/WeatherAwareTag')
    WeatherAwareTag = mod.WeatherAwareTag
  })

  it('renders tag label text', () => {
    const weatherTag = { type: 'indoor' as const, weatherSafe: true, label: 'Cozy Indoor' }
    render(<WeatherAwareTag weatherTag={weatherTag} conditions="rain" />)
    expect(screen.getByText('Cozy Indoor')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 9. SocialProofBadge
// ---------------------------------------------------------------------------

describe('SocialProofBadge', () => {
  let SocialProofBadge: any
  beforeEach(async () => {
    const mod = await import('@/components/SocialProofBadge')
    SocialProofBadge = mod.SocialProofBadge
  })

  it('renders proof label', () => {
    const proof = { friendVisitsThisWeek: 3, isFavoriteInCircle: false, trendingInCircle: false, label: '3 friends visited' }
    render(<SocialProofBadge proof={proof} avatars={[]} />)
    expect(screen.getByText('3 friends visited')).toBeDefined()
  })

  it('returns null when label is empty', () => {
    const proof = { friendVisitsThisWeek: 0, isFavoriteInCircle: false, trendingInCircle: false, label: '' }
    const { container } = render(<SocialProofBadge proof={proof} avatars={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 10. CreatorProfileBadge
// ---------------------------------------------------------------------------

describe('CreatorProfileBadge', () => {
  let CreatorProfileBadge: any
  beforeEach(async () => {
    const mod = await import('@/components/CreatorProfileBadge')
    CreatorProfileBadge = mod.CreatorProfileBadge
  })

  it.each([
    ['rising', 'Rising'],
    ['verified', 'Verified'],
    ['elite', 'Elite'],
  ] as const)('renders tier label for "%s"', (tier, expectedLabel) => {
    render(<CreatorProfileBadge tier={tier} />)
    expect(screen.getByText(expectedLabel)).toBeDefined()
  })

  it('hides label when showLabel is false', () => {
    render(<CreatorProfileBadge tier="rising" showLabel={false} />)
    expect(screen.queryByText('Rising')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 11. ReducedMotionWrapper
// ---------------------------------------------------------------------------

describe('ReducedMotionWrapper', () => {
  let ReducedMotionWrapper: any
  let useReducedMotion: any
  let getTransition: any
  let getMotionProps: any

  beforeEach(async () => {
    const mod = await import('@/components/ReducedMotionWrapper')
    ReducedMotionWrapper = mod.ReducedMotionWrapper
    useReducedMotion = mod.useReducedMotion
    getTransition = mod.getTransition
    getMotionProps = mod.getMotionProps
  })

  it('renders children with reducedMotion value', () => {
    render(
      <ReducedMotionWrapper forceReducedMotion={false}>
        {(rm: boolean) => <div>reduced: {String(rm)}</div>}
      </ReducedMotionWrapper>
    )
    expect(screen.getByText('reduced: false')).toBeDefined()
  })

  it('passes forceReducedMotion=true to children', () => {
    render(
      <ReducedMotionWrapper forceReducedMotion={true}>
        {(rm: boolean) => <div>reduced: {String(rm)}</div>}
      </ReducedMotionWrapper>
    )
    expect(screen.getByText('reduced: true')).toBeDefined()
  })

  it('getTransition returns instant transition when reduced', () => {
    const t = getTransition(true)
    expect(t.duration).toBe(0)
  })

  it('getMotionProps strips transition when reduced', () => {
    const props = getMotionProps(true, { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5 } })
    expect(props.transition.duration).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 12. ProgressiveImage
// ---------------------------------------------------------------------------

describe('ProgressiveImage', () => {
  let ProgressiveImage: any
  beforeEach(async () => {
    const mod = await import('@/components/ProgressiveImage')
    ProgressiveImage = mod.ProgressiveImage
  })

  it('renders with alt text via aria-label', () => {
    render(<ProgressiveImage src="/img.jpg" alt="A cool venue" />)
    const el = screen.getByRole('img')
    expect(el.getAttribute('aria-label')).toBe('A cool venue')
  })
})

// ---------------------------------------------------------------------------
// 13. FloatingReactions
// ---------------------------------------------------------------------------

describe('FloatingReactions', () => {
  let FloatingReactions: any
  beforeEach(async () => {
    const mod = await import('@/components/FloatingReactions')
    FloatingReactions = mod.default
  })

  it('renders reactions', () => {
    const reactions = [
      { id: 'r1', emoji: '🔥', timestamp: 1 },
      { id: 'r2', emoji: '❤️', timestamp: 2 },
    ]
    render(<FloatingReactions reactions={reactions} onComplete={vi.fn()} />)
    expect(screen.getByText('🔥')).toBeDefined()
    expect(screen.getByText('❤️')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 14. MicroInteractions
// ---------------------------------------------------------------------------

describe('MicroInteractions', () => {
  let SpringButton: any
  let AnimatedCounter: any

  beforeEach(async () => {
    const mod = await import('@/components/MicroInteractions')
    SpringButton = mod.SpringButton
    AnimatedCounter = mod.AnimatedCounter
  })

  it('SpringButton renders children', () => {
    render(<SpringButton>Click Me</SpringButton>)
    expect(screen.getByText('Click Me')).toBeDefined()
  })

  it('AnimatedCounter renders value', () => {
    render(<AnimatedCounter value={42} />)
    expect(screen.getByText('42')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 15. PageTransition
// ---------------------------------------------------------------------------

describe('PageTransition', () => {
  let PageTransition: any
  let TabTransition: any
  let SharedElement: any
  let StaggeredList: any
  let OverlayTransition: any

  beforeEach(async () => {
    const mod = await import('@/components/PageTransition')
    PageTransition = mod.PageTransition
    TabTransition = mod.TabTransition
    SharedElement = mod.SharedElement
    StaggeredList = mod.StaggeredList
    OverlayTransition = mod.OverlayTransition
  })

  it('PageTransition renders children', () => {
    render(<PageTransition pageKey="home"><div>Page Content</div></PageTransition>)
    expect(screen.getByText('Page Content')).toBeDefined()
  })

  it('TabTransition renders children', () => {
    render(<TabTransition tabKey="tab1"><div>Tab Content</div></TabTransition>)
    expect(screen.getByText('Tab Content')).toBeDefined()
  })

  it('StaggeredList renders child items', () => {
    render(<StaggeredList>{[<div key="a">Item A</div>, <div key="b">Item B</div>]}</StaggeredList>)
    expect(screen.getByText('Item A')).toBeDefined()
    expect(screen.getByText('Item B')).toBeDefined()
  })

  it('OverlayTransition renders children when open', () => {
    render(<OverlayTransition isOpen={true}><div>Overlay</div></OverlayTransition>)
    expect(screen.getByText('Overlay')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 16. DirectionalPageTransition (consolidated into PageTransition module)
// ---------------------------------------------------------------------------

describe('DirectionalPageTransition', () => {
  let DirectionalPageTransition: any
  beforeEach(async () => {
    const mod = await import('@/components/PageTransition')
    DirectionalPageTransition = mod.DirectionalPageTransition
  })

  it('renders children', () => {
    render(<DirectionalPageTransition><div>Hello</div></DirectionalPageTransition>)
    expect(screen.getByText('Hello')).toBeDefined()
  })

  it('applies className', () => {
    const { container } = render(
      <DirectionalPageTransition className="test-class"><div>Content</div></DirectionalPageTransition>
    )
    expect(container.querySelector('.test-class')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 17. ScrollAwareHeader
// ---------------------------------------------------------------------------

describe('ScrollAwareHeader', () => {
  let ScrollAwareHeader: any
  beforeEach(async () => {
    const mod = await import('@/components/ScrollAwareHeader')
    ScrollAwareHeader = mod.ScrollAwareHeader
  })

  it('renders children and locationName', () => {
    render(
      <ScrollAwareHeader isScrolled={false} scrollDirection={null} locationName="Brooklyn">
        <span>Header Content</span>
      </ScrollAwareHeader>
    )
    expect(screen.getByText('Header Content')).toBeDefined()
    expect(screen.getByText('Brooklyn')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 18. MilestoneAnimation
// ---------------------------------------------------------------------------

describe('MilestoneAnimation', () => {
  let MilestoneAnimation: any
  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/components/MilestoneAnimation')
    MilestoneAnimation = mod.MilestoneAnimation
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders dismiss button', () => {
    const onDismiss = vi.fn()
    render(<MilestoneAnimation milestone="10th_checkin" onDismiss={onDismiss} />)
    expect(screen.getByText('Amazing!')).toBeDefined()
  })

  it('renders milestone title', () => {
    render(<MilestoneAnimation milestone="10th_checkin" onDismiss={vi.fn()} />)
    expect(screen.getByText('Double Digits!')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 19. AudioVibePreview
// ---------------------------------------------------------------------------

describe('AudioVibePreview', () => {
  let AudioVibePreview: any
  beforeEach(async () => {
    const mod = await import('@/components/AudioVibePreview')
    AudioVibePreview = mod.AudioVibePreview
  })

  it('renders genre text', () => {
    render(<AudioVibePreview genre="Jazz" ambiance="Smooth vibes" volumeLevel="moderate" />)
    expect(screen.getByText('Jazz')).toBeDefined()
  })

  it('renders ambiance text', () => {
    render(<AudioVibePreview genre="Jazz" ambiance="Smooth vibes" volumeLevel="moderate" />)
    expect(screen.getByText('Smooth vibes')).toBeDefined()
  })

  it('renders volume label', () => {
    render(<AudioVibePreview genre="Jazz" ambiance="Smooth vibes" volumeLevel="loud" />)
    expect(screen.getByText('Loud')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 20. LiveCrowdIndicator
// ---------------------------------------------------------------------------

describe('LiveCrowdIndicator', () => {
  let LiveCrowdIndicator: any
  beforeEach(async () => {
    const mod = await import('@/components/LiveCrowdIndicator')
    LiveCrowdIndicator = mod.LiveCrowdIndicator
  })

  it('renders count and trend info', () => {
    render(<LiveCrowdIndicator count={42} trend="rising" />)
    expect(screen.getByText('people here now')).toBeDefined()
    expect(screen.getByText('Rising')).toBeDefined()
  })

  it('renders friend count when provided', () => {
    render(<LiveCrowdIndicator count={30} trend="steady" friendCount={3} />)
    expect(screen.getByText('Steady')).toBeDefined()
    expect(screen.getByText(/Including 3 friends/)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 21. VibeMatchMeter
// ---------------------------------------------------------------------------

describe('VibeMatchMeter', () => {
  let VibeMatchMeter: any
  beforeEach(async () => {
    const mod = await import('@/components/VibeMatchMeter')
    VibeMatchMeter = mod.VibeMatchMeter
  })

  it('renders match score and verdict', () => {
    const match = {
      overall: 82,
      breakdown: { musicMatch: 90, crowdMatch: 75, priceMatch: 80, friendOverlap: 60 },
      verdict: 'Great match!',
    }
    render(<VibeMatchMeter match={match} />)
    expect(screen.getByText('Vibe Match')).toBeDefined()
    expect(screen.getByText('Great match!')).toBeDefined()
    expect(screen.getByText('%')).toBeDefined()
  })

  it('renders breakdown labels', () => {
    const match = {
      overall: 50,
      breakdown: { musicMatch: 60, crowdMatch: 40, priceMatch: 55, friendOverlap: 30 },
      verdict: 'Decent',
    }
    render(<VibeMatchMeter match={match} />)
    expect(screen.getByText('Music')).toBeDefined()
    expect(screen.getByText('Crowd')).toBeDefined()
    expect(screen.getByText('Price')).toBeDefined()
    expect(screen.getByText('Friends')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 22. MoodSelector
// ---------------------------------------------------------------------------

describe('MoodSelector', () => {
  let MoodSelector: any
  beforeEach(async () => {
    const mod = await import('@/components/MoodSelector')
    MoodSelector = mod.default
  })

  it('renders mood options', () => {
    render(<MoodSelector onMoodSelect={vi.fn()} selectedMood={null} />)
    expect(screen.getByText('Chill')).toBeDefined()
    expect(screen.getByText('Wild')).toBeDefined()
    expect(screen.getByText('Date Night')).toBeDefined()
    expect(screen.getByText('Group Outing')).toBeDefined()
  })

  it('renders header text', () => {
    render(<MoodSelector onMoodSelect={vi.fn()} selectedMood={null} />)
    expect(screen.getByText(/the vibe/i)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 23. EnergySlider
// ---------------------------------------------------------------------------

describe('EnergySlider', () => {
  let EnergySlider: any
  beforeEach(async () => {
    const mod = await import('@/components/EnergySlider')
    EnergySlider = mod.EnergySlider
  })

  it('renders energy label', () => {
    render(
      <EnergySlider
        value="buzzing"
        onChange={vi.fn()}
        energyPhotos={{ dead: null, chill: null, buzzing: null, electric: null }}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />
    )
    expect(screen.getByText('Buzzing')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 24. SkeletonCascade (consolidated from SkeletonCard + SkeletonCascade)
// ---------------------------------------------------------------------------

describe('SkeletonCascade', () => {
  let SkeletonCascade: any
  let VenueCardSkeleton: any
  let PulseCardSkeleton: any
  let NotificationCardSkeleton: any
  let SkeletonList: any

  beforeEach(async () => {
    const mod = await import('@/components/SkeletonCascade')
    SkeletonCascade = mod.SkeletonCascade
    VenueCardSkeleton = mod.VenueCardSkeleton
    PulseCardSkeleton = mod.PulseCardSkeleton
    NotificationCardSkeleton = mod.NotificationCardSkeleton
    SkeletonList = mod.SkeletonList
  })

  it('renders correct number of items', () => {
    const { container } = render(<SkeletonCascade count={4} variant="venue" />)
    const items = container.querySelectorAll('.rounded-xl')
    expect(items.length).toBeGreaterThanOrEqual(4)
  })

  it('defaults to 5 items', () => {
    const { container } = render(<SkeletonCascade variant="pulse" />)
    const items = container.querySelectorAll('.rounded-xl')
    expect(items.length).toBeGreaterThanOrEqual(5)
  })

  it('VenueCardSkeleton renders', () => {
    const { container } = render(<VenueCardSkeleton />)
    expect(container.querySelector('.rounded-xl')).not.toBeNull()
  })

  it('PulseCardSkeleton renders', () => {
    const { container } = render(<PulseCardSkeleton />)
    expect(container.querySelector('.rounded-xl')).not.toBeNull()
  })

  it('NotificationCardSkeleton renders', () => {
    const { container } = render(<NotificationCardSkeleton />)
    expect(container.querySelector('.rounded-xl')).not.toBeNull()
  })

  it('SkeletonList renders multiple skeletons via SkeletonCascade', () => {
    const { container } = render(<SkeletonList count={3} type="venue" />)
    const items = container.querySelectorAll('.rounded-xl')
    expect(items.length).toBeGreaterThanOrEqual(3)
  })
})
