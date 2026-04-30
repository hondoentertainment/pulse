// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User, Pulse, Venue } from '@/lib/types'

/**
 * Tests for the "Friends on map" layer toggle in `InteractiveMap`.
 *
 * Privacy invariants exercised:
 *   - default OFF → zero dots
 *   - signed-out user → zero dots even when ON
 *   - < 2 familiar faces at a venue → engine suppresses → zero dots
 *   - ≥ 2 familiar faces at a venue → one dot per venue with per-venue
 *     jitter applied (position ≠ exact venue coord)
 */

// ── Mocks ────────────────────────────────────────────────────────────
// framer-motion: strip animation props so test assertions on rendered
// DOM aren't confused by motion's runtime props.
vi.mock('framer-motion', () => {
  const strip = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {}
    const blocked = new Set([
      'initial', 'animate', 'exit', 'transition',
      'whileHover', 'whileTap', 'whileInView', 'variants',
      'layout', 'layoutId', 'style'
    ])
    for (const [k, v] of Object.entries(props)) {
      if (blocked.has(k)) continue
      if (typeof v === 'function' && !k.startsWith('on')) continue
      filtered[k] = v
    }
    return filtered
  }
  const makeTag = (tag: string) => ({ children, ...p }: any) => {
    const Tag = tag as any
    return <Tag {...strip(p)}>{children}</Tag>
  }
  return {
    motion: new Proxy({}, {
      get: (_t, prop: string) => makeTag(prop === 'g' ? 'g' : prop),
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

// Mapbox base layer: render nothing, no tokens needed in jsdom.
vi.mock('@/components/MapboxBaseLayer', () => ({
  MapboxBaseLayer: () => null,
}))

// GPS indicator — noisy and irrelevant.
vi.mock('@/components/GPSIndicator', () => ({
  GPSIndicator: () => null,
}))

// MapSearch uses hooks we don't need here.
vi.mock('@/components/MapSearch', () => ({
  MapSearch: () => null,
}))

// Filter popover — inert for these tests.
vi.mock('@/components/MapFilters', () => ({
  MapFilters: () => null,
  // Forward the type-only symbol so the module is structurally compatible.
}))

// Pulse score badge.
vi.mock('@/components/PulseScore', () => ({
  PulseScore: () => null,
}))

// Accessibility filter guard.
vi.mock('@/components/filters/AccessibilityFilter', () => ({
  venuePassesAccessibilityFilter: () => true,
  AccessibilityFilter: () => null,
}))

// Haptics — no-op.
vi.mock('@/lib/haptics', () => ({
  triggerHapticFeedback: vi.fn(),
}))

// Unit preferences — deterministic.
vi.mock('@/hooks/use-unit-preference', () => ({
  useUnitPreference: () => ({ unitSystem: 'imperial' as const, setUnitSystem: vi.fn() }),
}))

// Analytics spy — asserted separately in a dedicated test below.
const trackEventSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({
  trackEvent: (ev: unknown) => trackEventSpy(ev),
}))

// Icon stubs — keep the tree light and predictable. Vitest requires an
// explicit object (not a Proxy) so named-export lookup works.
vi.mock('@phosphor-icons/react', () => {
  const Icon = (_props: any) => <span />
  const names = [
    'MapPin', 'NavigationArrow', 'Plus', 'Minus',
    'BeerBottle', 'MusicNotes', 'ForkKnife', 'Coffee', 'Martini', 'Confetti',
    'Users', 'UsersThree', 'Fire', 'Lock',
  ] as const
  const mod: Record<string, unknown> = {}
  for (const n of names) mod[n] = Icon
  return mod
})

// ── Fixtures ─────────────────────────────────────────────────────────
function makeUser(over: Partial<User> & { id: string }): User {
  return {
    id: over.id,
    username: over.username ?? over.id,
    friends: over.friends ?? [],
    createdAt: new Date().toISOString(),
    presenceSettings: over.presenceSettings ?? {
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: false,
    },
    profilePhoto: over.profilePhoto ?? 'https://img/x.png',
    ...over,
  }
}

function makeVenue(over: Partial<Venue> = {}): Venue {
  return {
    id: over.id ?? 'venue-1',
    name: over.name ?? 'Test Venue',
    location: over.location ?? { lat: 47.6, lng: -122.3, address: '1 Test St' },
    pulseScore: over.pulseScore ?? 50,
    ...over,
  }
}

const USER_ME = makeUser({ id: 'me', friends: ['friend-1', 'friend-2'] })
const FRIEND_1 = makeUser({ id: 'friend-1', friends: ['me'] })
const FRIEND_2 = makeUser({ id: 'friend-2', friends: ['me'] })
const VENUE = makeVenue({ id: 'venue-1', location: { lat: 47.6, lng: -122.3, address: 'x' } })

function nearbyLoc() {
  return {
    lat: VENUE.location.lat + 0.00001,
    lng: VENUE.location.lng - 0.00001,
    lastUpdate: new Date().toISOString(),
  }
}

// ── Import under test (after mocks) ──────────────────────────────────
import { InteractiveMap, FRIEND_LAYER_STORAGE_KEY } from '@/components/InteractiveMap'

function renderMap(overrides: Partial<React.ComponentProps<typeof InteractiveMap>> = {}) {
  const props: React.ComponentProps<typeof InteractiveMap> = {
    venues: [VENUE],
    userLocation: { lat: VENUE.location.lat, lng: VENUE.location.lng },
    onVenueClick: vi.fn(),
    ...overrides,
  }
  return render(<InteractiveMap {...props} />)
}

function countFriendLayerDots(container: HTMLElement): number {
  return container.querySelectorAll('g.friend-map-dots > g').length
}

describe('InteractiveMap — friends-on-map layer', () => {
  beforeEach(() => {
    trackEventSpy.mockReset()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('default OFF → renders zero friend dots even with 2+ friends nearby', () => {
    const pulses: Pulse[] = []
    const { container } = renderMap({
      friendPresence: {
        currentUser: USER_ME,
        allUsers: [FRIEND_1, FRIEND_2],
        allPulses: pulses,
        userLocations: {
          'friend-1': nearbyLoc(),
          'friend-2': nearbyLoc(),
        },
      },
    })
    expect(countFriendLayerDots(container)).toBe(0)
    expect(window.sessionStorage.getItem(FRIEND_LAYER_STORAGE_KEY)).toBeNull()
  })

  it('toggle ON + user signed out → renders zero friend dots', () => {
    const { container } = renderMap({
      friendPresence: {
        currentUser: null,
        allUsers: [FRIEND_1, FRIEND_2],
        allPulses: [],
        userLocations: {
          'friend-1': nearbyLoc(),
          'friend-2': nearbyLoc(),
        },
      },
    })
    fireEvent.click(screen.getByTestId('friend-layer-toggle'))
    expect(window.sessionStorage.getItem(FRIEND_LAYER_STORAGE_KEY)).toBe('true')
    expect(countFriendLayerDots(container)).toBe(0)
  })

  it('toggle ON + single friend (below 2+ threshold) → engine suppresses, zero dots', () => {
    const { container } = renderMap({
      friendPresence: {
        currentUser: USER_ME,
        allUsers: [FRIEND_1],
        allPulses: [],
        userLocations: {
          'friend-1': nearbyLoc(),
        },
      },
    })
    fireEvent.click(screen.getByTestId('friend-layer-toggle'))
    expect(countFriendLayerDots(container)).toBe(0)
  })

  it('toggle ON + 2+ friends → renders one dot with per-venue jitter', () => {
    const { container } = renderMap({
      friendPresence: {
        currentUser: USER_ME,
        allUsers: [FRIEND_1, FRIEND_2],
        allPulses: [],
        userLocations: {
          'friend-1': nearbyLoc(),
          'friend-2': nearbyLoc(),
        },
      },
    })
    fireEvent.click(screen.getByTestId('friend-layer-toggle'))

    // Exactly one dot (we render one aggregate dot per non-suppressed venue).
    expect(countFriendLayerDots(container)).toBe(1)

    // Jitter check: the rendered group's transform must not place the dot
    // on the exact venue pixel. We find the venue-anchor pixel by comparing
    // against the user-location circle center (which is rendered at the same
    // coordinate since userLocation === venue location in this test).
    const friendDot = container.querySelector('g.friend-map-dots > g') as SVGGElement | null
    expect(friendDot).not.toBeNull()
    const transform = friendDot!.getAttribute('transform') ?? ''
    const match = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(transform)
    expect(match).not.toBeNull()
    const dotX = Number(match![1])
    const dotY = Number(match![2])

    // The user-location dot is centered at the map origin (center === userLocation).
    // In jsdom with default dimensions (width 800 / height 600) that origin is
    // (400, 300). Use that as the exact venue pixel for the jitter comparison.
    const exactX = 400
    const exactY = 300
    const deltaX = Math.abs(dotX - exactX)
    const deltaY = Math.abs(dotY - exactY)
    // Jitter is deterministic (seeded from venueId) and small but non-zero.
    // We assert "not exactly on centre", allowing for jsdom layout nuance.
    expect(deltaX + deltaY).toBeGreaterThan(0)
  })

  it('toggle fires trackEvent("friend_presence_layer_toggled") with the new enabled state', () => {
    renderMap({
      friendPresence: {
        currentUser: USER_ME,
        allUsers: [FRIEND_1, FRIEND_2],
        allPulses: [],
        userLocations: {
          'friend-1': nearbyLoc(),
          'friend-2': nearbyLoc(),
        },
      },
    })
    fireEvent.click(screen.getByTestId('friend-layer-toggle'))
    expect(trackEventSpy).toHaveBeenCalledTimes(1)
    expect(trackEventSpy.mock.calls[0][0]).toMatchObject({
      type: 'friend_presence_layer_toggled',
      enabled: true,
    })

    fireEvent.click(screen.getByTestId('friend-layer-toggle'))
    expect(trackEventSpy).toHaveBeenCalledTimes(2)
    expect(trackEventSpy.mock.calls[1][0]).toMatchObject({
      type: 'friend_presence_layer_toggled',
      enabled: false,
    })
  })
})
