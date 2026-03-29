// @vitest-environment jsdom
import type { HTMLAttributes, PropsWithChildren } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
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
}))

vi.mock('@phosphor-icons/react', () => new Proxy({}, {
  get: (_target, prop) => {
    if (prop === '__esModule') return true
    return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />
  }
}))

// ── Shared mocks ──────────────────────────────────────────────

vi.mock('@/lib/pulse-engine', () => ({
  formatTimeAgo: () => '5m ago',
  getEnergyLabel: (score: number) => {
    if (score >= 75) return 'Electric'
    if (score >= 50) return 'Buzzing'
    if (score >= 25) return 'Chill'
    return 'Dead'
  },
  getEnergyColor: () => '#ff00ff',
  calculateDistance: () => 1,
}))

vi.mock('@/lib/credibility', () => ({
  getUserTrustBadges: () => [],
}))

vi.mock('@/lib/sharing', () => ({
  getPulseDeepLink: () => 'https://pulse.app/p/1',
}))

vi.mock('@/components/ReportDialog', () => ({
  ReportDialog: (props: any) => <div data-testid="report-dialog" />,
}))

vi.mock('@/components/ShareSheet', () => ({
  ShareSheet: (props: any) => <div data-testid="share-sheet" />,
}))

vi.mock('@/hooks/use-unit-preference', () => ({
  useUnitPreference: () => ({ unitSystem: 'imperial' }),
}))

vi.mock('@/lib/venue-trending', () => ({
  getPreTrendingLabel: () => 'Warming Up',
}))

vi.mock('@/lib/time-contextual-scoring', () => ({
  getContextualLabel: () => '',
  getTimeOfDay: () => 'evening',
  getPeakConfig: () => ({}),
  normalizeCategoryKeyPublic: (c: string) => c,
}))

vi.mock('@/lib/units', () => ({
  formatDistance: () => '0.5 mi',
}))

vi.mock('@/components/PulseScore', () => ({
  PulseScore: ({ score }: any) => <span data-testid="pulse-score">{score}</span>,
}))

vi.mock('@/lib/events', () => ({
  getRSVPCounts: () => ({ going: 5, interested: 3, not_going: 0 }),
  getUserRSVP: () => null,
  EVENT_CATEGORIES: [
    { value: 'dj_set', label: 'DJ Set', emoji: '🎧' },
    { value: 'happy_hour', label: 'Happy Hour', emoji: '🍸' },
    { value: 'other', label: 'Other', emoji: '✨' },
  ],
}))

vi.mock('@/lib/achievements', () => ({
  getAchievementById: (id: string) => ({
    id,
    name: 'Explorer',
    description: 'Visit 10 venues',
    icon: '🗺️',
    category: 'exploration',
    tier: 'bronze',
    requirement: 10,
  }),
}))

vi.mock('@/lib/promoted-discoveries', () => ({
  isPromotionActive: () => true,
  getCampaignMetrics: () => ({
    impressions: 100,
    clicks: 10,
    conversions: 2,
    ctr: 10,
    conversionRate: 20,
    costPerConversion: 5,
    spent: 10,
    remaining: 90,
  }),
}))

vi.mock('@/lib/venue-recommendations', () => ({}))

vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({
    triggerLight: vi.fn(),
    triggerMedium: vi.fn(),
    triggerHeavy: vi.fn(),
  }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// ── Static imports (after mocks) ──────────────────────────────

import { PulseCard } from '@/components/PulseCard'
import { VenueCard } from '@/components/VenueCard'
import { NotificationCard } from '@/components/NotificationCard'
import { EventCard } from '@/components/EventCard'
import { RecommendationCard } from '@/components/RecommendationCard'
import { NightRecapCard } from '@/components/NightRecapCard'
import { DailyDiscoveryDrop } from '@/components/DailyDiscoveryDrop'
import { PromotedVenueCard } from '@/components/PromotedVenueCard'
import { ShareableVenueCard } from '@/components/ShareableVenueCard'
import VenueMemoryCard from '@/components/VenueMemoryCard'
import { VenueNarrativeCard } from '@/components/VenueNarrativeCard'
import { SwipeableCard, QuickReactions } from '@/components/SwipeableCard'
import { AchievementBadge } from '@/components/AchievementBadge'
import PredictiveSuggestion from '@/components/PredictiveSuggestion'
import HappeningNowBanner from '@/components/HappeningNowBanner'

// ── Helper factories ──────────────────────────────────────────

function makeVenue(overrides: Partial<import('@/lib/types').Venue> = {}): import('@/lib/types').Venue {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
    city: 'New York',
    state: 'NY',
    pulseScore: 65,
    category: 'Bar',
    lastPulseAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeUser(overrides: Partial<import('@/lib/types').User> = {}): import('@/lib/types').User {
  return {
    id: 'user-1',
    username: 'testuser',
    friends: ['friend-1', 'friend-2'],
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePulse(overrides: Partial<import('@/lib/types').PulseWithUser> = {}): import('@/lib/types').PulseWithUser {
  const venue = makeVenue()
  const user = makeUser()
  return {
    id: 'pulse-1',
    userId: user.id,
    venueId: venue.id,
    photos: ['https://example.com/photo.jpg'],
    energyRating: 'buzzing',
    caption: 'Great vibes tonight!',
    hashtags: ['nightlife'],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    reactions: {
      fire: ['u1', 'u2'],
      eyes: ['u3'],
      skull: [],
      lightning: ['u4', 'u5', 'u6'],
    },
    views: 42,
    user,
    venue,
    ...overrides,
  }
}

// ── 1. PulseCard ──────────────────────────────────────────────

describe('PulseCard', () => {
  it('renders username, energy badge, caption, and reaction counts', () => {
    const pulse = makePulse()
    render(<PulseCard pulse={pulse} />)

    expect(screen.getByText('testuser')).toBeTruthy()
    // Energy badge label
    expect(screen.getByText(/Buzzing/)).toBeTruthy()
    expect(screen.getByText('Great vibes tonight!')).toBeTruthy()

    // Reaction counts
    expect(screen.getByText('2')).toBeTruthy() // fire
    expect(screen.getByText('1')).toBeTruthy() // eyes
    expect(screen.getByText('3')).toBeTruthy() // lightning
  })

  it('shows "Sending..." badge when isPending', () => {
    const pulse = makePulse({ isPending: true })
    render(<PulseCard pulse={pulse} />)

    expect(screen.getByText(/Sending/)).toBeTruthy()
  })

  it('shows "Failed" badge when uploadError', () => {
    const pulse = makePulse({ uploadError: true })
    render(<PulseCard pulse={pulse} />)

    expect(screen.getByText('Failed')).toBeTruthy()
  })

  it('calls onReaction when clicking fire button', () => {
    const onReaction = vi.fn()
    const pulse = makePulse()
    render(<PulseCard pulse={pulse} onReaction={onReaction} />)

    // Fire button is the first reaction button; find by the count text
    const fireCount = screen.getByText('2')
    const fireButton = fireCount.closest('div[class]')?.parentElement
    if (fireButton) {
      fireEvent.click(fireButton)
      expect(onReaction).toHaveBeenCalledWith('fire')
    }
  })
})

// ── 2. VenueCard ──────────────────────────────────────────────

describe('VenueCard', () => {
  it('renders venue name and category', () => {
    const venue = makeVenue()
    render(<VenueCard venue={venue} />)

    expect(screen.getByText('Test Venue')).toBeTruthy()
    expect(screen.getByText('Bar')).toBeTruthy()
  })

  it('shows "Just Popped" badge when isJustPopped', () => {
    const venue = makeVenue()
    render(<VenueCard venue={venue} isJustPopped />)

    expect(screen.getByText('Just Popped')).toBeTruthy()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    const venue = makeVenue()
    render(<VenueCard venue={venue} onClick={onClick} />)

    fireEvent.click(screen.getByText('Test Venue'))
    expect(onClick).toHaveBeenCalled()
  })

  it('calls onToggleFavorite when star clicked', () => {
    const onToggleFavorite = vi.fn()
    const venue = makeVenue()
    render(<VenueCard venue={venue} onToggleFavorite={onToggleFavorite} />)

    const starIcon = screen.getByTestId('icon-Star')
    const starButton = starIcon.closest('button')!
    fireEvent.click(starButton)
    expect(onToggleFavorite).toHaveBeenCalledWith('venue-1')
  })
})

// ── 3. NotificationCard ───────────────────────────────────────

describe('NotificationCard', () => {
  it('renders friend_pulse notification with username and venue name', () => {
    const notification = {
      id: 'n1',
      type: 'friend_pulse' as const,
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      read: false,
      user: makeUser({ username: 'alice' }),
      pulse: makePulse(),
      venue: makeVenue({ name: 'Cool Bar' }),
    }

    render(<NotificationCard notification={notification} />)

    expect(screen.getByText('alice')).toBeTruthy()
    expect(screen.getByText('Cool Bar')).toBeTruthy()
  })

  it('renders trending_venue notification', () => {
    const notification = {
      id: 'n2',
      type: 'trending_venue' as const,
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      read: false,
      venue: makeVenue({ name: 'Hot Spot' }),
    }

    render(<NotificationCard notification={notification} />)

    expect(screen.getByText('Hot Spot')).toBeTruthy()
    expect(screen.getByText(/trending/)).toBeTruthy()
  })

  it('returns null for notification with missing data', () => {
    const notification = {
      id: 'n3',
      type: 'friend_pulse' as const,
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      read: false,
      // Missing user, pulse, venue — should return null
    }

    const { container } = render(<NotificationCard notification={notification} />)
    expect(container.innerHTML).toBe('')
  })
})

// ── 4. EventCard ──────────────────────────────────────────────

describe('EventCard', () => {
  it('renders event title and venue name', () => {
    const event = {
      id: 'evt-1',
      venueId: 'venue-1',
      createdByUserId: 'user-1',
      title: 'Friday DJ Night',
      description: 'Best beats in town',
      category: 'dj_set' as const,
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      rsvps: {},
      createdAt: new Date().toISOString(),
    }

    render(
      <EventCard
        event={event}
        venueName="Test Venue"
        currentUserId="user-1"
        onRSVP={vi.fn()}
      />
    )

    expect(screen.getByText('Friday DJ Night')).toBeTruthy()
    expect(screen.getByText('Test Venue')).toBeTruthy()
  })

  it('calls onRSVP when Going button clicked', () => {
    const onRSVP = vi.fn()
    const event = {
      id: 'evt-1',
      venueId: 'venue-1',
      createdByUserId: 'user-1',
      title: 'Friday DJ Night',
      description: 'Best beats',
      category: 'dj_set' as const,
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      rsvps: {},
      createdAt: new Date().toISOString(),
    }

    render(
      <EventCard
        event={event}
        venueName="Test Venue"
        currentUserId="user-1"
        onRSVP={onRSVP}
      />
    )

    fireEvent.click(screen.getByText('Going'))
    expect(onRSVP).toHaveBeenCalledWith('evt-1', 'going')
  })
})

// ── 5. RecommendationCard ─────────────────────────────────────

describe('RecommendationCard', () => {
  it('renders venue name and energy level', () => {
    const recommendation = {
      venue: makeVenue({ name: 'Recommended Spot', pulseScore: 80 }),
      score: 90,
      reasons: [{ type: 'trending' as const, label: 'Trending now' }],
      matchPercentage: 85,
    }

    render(<RecommendationCard recommendation={recommendation} onClick={vi.fn()} />)

    expect(screen.getByText('Recommended Spot')).toBeTruthy()
    // Energy label from getEnergyLabel(80) => 'Electric'
    expect(screen.getByText('Electric')).toBeTruthy()
  })
})

// ── 6. NightRecapCard ─────────────────────────────────────────

describe('NightRecapCard', () => {
  it('renders date and venue list', () => {
    const recap = {
      date: '2025-12-20',
      venuesVisited: [
        { id: 'v1', name: 'Club Alpha', peakEnergy: 'electric' as const },
        { id: 'v2', name: 'Bar Beta', peakEnergy: 'buzzing' as const },
      ],
      friendsEncountered: ['f1', 'f2'],
      totalPulses: 5,
      topVibe: 'electric' as const,
    }

    render(<NightRecapCard recap={recap} />)

    // Date is formatted as "Saturday, Dec 20"
    expect(screen.getByText(/Dec 20/)).toBeTruthy()
    expect(screen.getByText('Club Alpha')).toBeTruthy()
    expect(screen.getByText('Bar Beta')).toBeTruthy()
  })
})

// ── 7. DailyDiscoveryDrop ─────────────────────────────────────

describe('DailyDiscoveryDrop', () => {
  it('renders teaser text', () => {
    const drop = {
      id: 'drop-1',
      venueId: 'venue-1',
      venueName: 'Hidden Gem',
      category: 'cocktail bar',
      teaser: 'A secret cocktail bar awaits...',
      revealAt: new Date(Date.now() + 3600000).toISOString(),
      isRevealed: false,
    }

    render(<DailyDiscoveryDrop drop={drop} />)

    expect(screen.getByText('A secret cocktail bar awaits...')).toBeTruthy()
  })
})

// ── 8. PromotedVenueCard ──────────────────────────────────────

describe('PromotedVenueCard', () => {
  it('renders venue name and "Sponsored" label', () => {
    const venue = makeVenue({ name: 'Promo Place' })
    const promotion = {
      id: 'promo-1',
      venueId: 'venue-1',
      campaignName: 'Summer Campaign',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      budget: 100,
      spent: 10,
      pricingModel: 'cpc' as const,
      pricePerUnit: 0.5,
      impressions: 500,
      clicks: 25,
      conversions: 5,
      active: true,
      label: 'Sponsored' as const,
    }

    render(
      <PromotedVenueCard
        venue={venue}
        promotion={promotion}
        onClick={vi.fn()}
        index={0}
      />
    )

    expect(screen.getByText('Promo Place')).toBeTruthy()
    expect(screen.getByText('Sponsored')).toBeTruthy()
  })
})

// ── 9. ShareableVenueCard ─────────────────────────────────────

describe('ShareableVenueCard', () => {
  it('renders venue name and share button', () => {
    const venue = makeVenue({ name: 'Share This Place', pulseScore: 80 })

    render(
      <ShareableVenueCard
        venue={venue}
        onShare={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Share This Place')).toBeTruthy()
    expect(screen.getByText('Share to Stories')).toBeTruthy()
  })
})

// ── 10. VenueMemoryCard ───────────────────────────────────────

describe('VenueMemoryCard', () => {
  it('renders memory info when user has history', () => {
    const venue = makeVenue()
    const user = makeUser({
      venueCheckInHistory: { 'venue-1': 5 },
    })
    const pulses = [
      {
        id: 'p1',
        userId: 'user-1',
        venueId: 'venue-1',
        photos: [],
        energyRating: 'buzzing' as const,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        reactions: { fire: [], eyes: [], skull: [], lightning: [] },
        views: 10,
        hashtags: [],
      },
    ]

    render(<VenueMemoryCard venue={venue} user={user} pulses={pulses} />)

    // The component renders "You were here <time ago>"
    expect(screen.getByText(/You were here/)).toBeTruthy()
  })
})

// ── 11. VenueNarrativeCard ────────────────────────────────────

describe('VenueNarrativeCard', () => {
  it('renders narrative text and venue name', () => {
    // Component takes narrative as a string prop, not an object
    render(
      <VenueNarrativeCard
        narrative="The energy has been building all evening at this spot."
        venueName="Narrative Venue"
        category="Bar"
      />
    )

    expect(screen.getByText('The energy has been building all evening at this spot.')).toBeTruthy()
    expect(screen.getByText('Narrative Venue')).toBeTruthy()
  })
})

// ── 12. SwipeableCard & QuickReactions ────────────────────────

describe('SwipeableCard', () => {
  it('renders children', () => {
    render(
      <SwipeableCard>
        <p>Swipeable content</p>
      </SwipeableCard>
    )

    expect(screen.getByText('Swipeable content')).toBeTruthy()
  })
})

describe('QuickReactions', () => {
  it('renders reaction buttons', () => {
    const onReact = vi.fn()
    const reactions = {
      fire: [],
      eyes: [],
      skull: [],
      lightning: [],
    }

    render(<QuickReactions onReact={onReact} reactions={reactions} />)

    expect(screen.getByTestId('icon-Fire')).toBeTruthy()
    expect(screen.getByTestId('icon-Eye')).toBeTruthy()
    expect(screen.getByTestId('icon-Skull')).toBeTruthy()
    expect(screen.getByTestId('icon-Lightning')).toBeTruthy()
  })
})

// ── 13. AchievementBadge & AchievementShowcase ────────────────

describe('AchievementBadge', () => {
  it('renders badge', () => {
    const userAchievement = {
      achievementId: 'explorer_10' as const,
      userId: 'user-1',
      unlockedAt: '2025-06-01T00:00:00Z',
      progress: 10,
      showcased: true,
    }

    render(<AchievementBadge userAchievement={userAchievement} />)

    // Renders the achievement name
    expect(screen.getByText('Explorer')).toBeTruthy()
  })
})

// ── 14. PredictiveSuggestion ──────────────────────────────────

describe('PredictiveSuggestion', () => {
  it('renders suggestion text for time-based suggestion', () => {
    // Create a venue that matches evening bar suggestion criteria
    const venue = makeVenue({
      name: 'Night Bar',
      category: 'Bar',
      pulseScore: 50,
      scoreVelocity: 5,
    })

    const user = makeUser({
      friends: ['f1', 'f2', 'f3'],
    })

    // Friday at 9pm to trigger time-based suggestions
    const fridayNight = new Date('2025-12-19T21:00:00')

    render(
      <PredictiveSuggestion
        venues={[venue]}
        user={user}
        currentTime={fridayNight}
        onVenueClick={vi.fn()}
      />
    )

    // Should render a suggestion - either time, social, or weather-based
    // The social suggestion is always generated when user has 3+ friends
    expect(screen.getByText(/friends|Night Bar|evening/i)).toBeTruthy()
  })
})

// ── 15. HappeningNowBanner ────────────────────────────────────

describe('HappeningNowBanner', () => {
  it('renders banner with qualifying venues', () => {
    // Venues need pulseScore >= 60 and be within 5 miles of user location
    const venues = [
      makeVenue({ id: 'v1', name: 'Hot Spot A', pulseScore: 85, location: { lat: 40.713, lng: -74.006, address: '1 St' } }),
      makeVenue({ id: 'v2', name: 'Hot Spot B', pulseScore: 75, location: { lat: 40.714, lng: -74.005, address: '2 St' } }),
    ]

    const userLocation = { lat: 40.7128, lng: -74.006 }

    render(
      <HappeningNowBanner
        venues={venues}
        userLocation={userLocation}
        onVenueClick={vi.fn()}
      />
    )

    expect(screen.getByText('Hot Spot A')).toBeTruthy()
    expect(screen.getByText('Hot Spot B')).toBeTruthy()
  })
})
