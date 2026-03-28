/**
 * Shared test utilities: mock factories, render helpers, and setup/teardown.
 *
 * Import from here in any test that needs consistent fixture data or a
 * pre-wired render wrapper.
 */

import { vi } from 'vitest'
import type {
  User,
  Venue,
  Pulse,
  PulseWithUser,
  Notification,
  EnergyRating,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Data factories
// ---------------------------------------------------------------------------

let _counter = 0
function uid(prefix = 'id') {
  return `${prefix}-${++_counter}`
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: uid('user'),
    username: 'testuser',
    profilePhoto: '',
    friends: [],
    favoriteVenues: [],
    followedVenues: [],
    createdAt: new Date('2025-01-01T00:00:00Z').toISOString(),
    venueCheckInHistory: {},
    favoriteCategories: [],
    credibilityScore: 1.0,
    presenceSettings: {
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: false,
    },
    postStreak: 0,
    lastPostDate: undefined,
    ...overrides,
  }
}

export function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: uid('venue'),
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '123 Main St, New York, NY' },
    city: 'New York',
    state: 'NY',
    category: 'bar',
    pulseScore: 65,
    lastPulseAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: uid('pulse'),
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'buzzing' as EnergyRating,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    isPending: false,
    uploadError: false,
    ...overrides,
  }
}

export function makePulseWithUser(
  pulseOverrides: Partial<Pulse> = {},
  userOverrides: Partial<User> = {},
  venueOverrides: Partial<Venue> = {},
): PulseWithUser {
  const user = makeUser(userOverrides)
  const venue = makeVenue(venueOverrides)
  const pulse = makePulse({ userId: user.id, venueId: venue.id, ...pulseOverrides })
  return { ...pulse, user, venue }
}

export function makeNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: uid('notif'),
    type: 'friend_pulse',
    userId: 'user-1',
    venueId: 'venue-1',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

/**
 * Returns a vitest-compatible mock of the Supabase client.
 *
 * Override individual methods in your test:
 *   const mockClient = createMockSupabaseClient()
 *   mockClient.from('pulses').select.mockResolvedValueOnce({ data: [...], error: null })
 */
export function createMockSupabaseClient() {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
  }

  // make the terminal methods resolve by default
  ;(queryBuilder.select as unknown as { mockResolvedValue: (v: unknown) => unknown }).mockResolvedValue = vi.fn().mockResolvedValue({ data: [], error: null })

  const from = vi.fn().mockReturnValue(queryBuilder)

  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  }

  const authState = {
    subscription: { unsubscribe: vi.fn() },
  }

  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: authState }),
    signInAnonymously: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  }

  return { from, channel, auth, _queryBuilder: queryBuilder }
}

// ---------------------------------------------------------------------------
// Common setup / teardown helpers
// ---------------------------------------------------------------------------

/**
 * Clears all vi.fn() mocks between tests.
 * Call in beforeEach / afterEach as needed.
 */
export function resetAllMocks() {
  vi.clearAllMocks()
}

/**
 * Suppress console.error in tests that expect error paths.
 * Returns a restore function – call it in afterEach.
 */
export function suppressConsoleError(): () => void {
  const original = console.error
  console.error = vi.fn()
  return () => {
    console.error = original
  }
}

/**
 * Advance fake timers by the given milliseconds.
 * Requires vi.useFakeTimers() to already be active.
 */
export function tick(ms = 0) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
    vi.advanceTimersByTime(ms)
  })
}
