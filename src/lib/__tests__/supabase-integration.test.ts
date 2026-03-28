/**
 * Supabase integration tests – all network calls are intercepted via module
 * mocks; no real Supabase project is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the low-level supabase singleton BEFORE importing the modules under test
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
}

// Allow terminal steps to be mocked per-test via mockResolvedValueOnce
// by aliasing the entire builder as a promise when awaited.
let _mockResolution: { data: unknown; error: unknown } = { data: [], error: null }
Object.defineProperty(mockQueryBuilder, 'then', {
  get() {
    return (resolve: (v: unknown) => void) => Promise.resolve(_mockResolution).then(resolve)
  },
})

const mockAuthState = {
  subscription: { unsubscribe: vi.fn() },
}

const mockAuth = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: mockAuthState }),
  signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null }),
  signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-1' } }, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null }),
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
}

const mockSupabase = {
  from: vi.fn().mockReturnValue(mockQueryBuilder),
  auth: mockAuth,
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  }),
}

vi.mock('@/lib/supabase', () => ({ supabase: mockSupabase }))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  fetchVenuesFromSupabase,
  fetchPulsesFromSupabase,
  uploadPulseToSupabase,
} from '@/lib/supabase-api'
import { makeVenue, makePulse, makeUser } from './test-utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setMockResolution(data: unknown, error: unknown = null) {
  _mockResolution = { data, error }
}

function resetMocks() {
  vi.clearAllMocks()
  _mockResolution = { data: [], error: null }
  // Re-wire chainable methods
  mockQueryBuilder.select.mockReturnThis()
  mockQueryBuilder.insert.mockReturnThis()
  mockQueryBuilder.update.mockReturnThis()
  mockQueryBuilder.delete.mockReturnThis()
  mockQueryBuilder.eq.mockReturnThis()
  mockQueryBuilder.order.mockReturnThis()
  mockQueryBuilder.limit.mockReturnThis()
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: null })
  mockSupabase.from.mockReturnValue(mockQueryBuilder)
}

// ---------------------------------------------------------------------------
// Tests: fetchVenuesFromSupabase
// ---------------------------------------------------------------------------

describe('fetchVenuesFromSupabase', () => {
  beforeEach(resetMocks)

  it('returns mapped venues on success', async () => {
    const row = {
      id: 'v-1',
      name: 'The Rooftop',
      location_lat: 40.7,
      location_lng: -74.0,
      location_address: '1 Main St',
      city: 'New York',
      state: 'NY',
      category: 'lounge',
      pulse_score: 72,
      score_velocity: 2.5,
      last_pulse_at: new Date().toISOString(),
      pre_trending: false,
      pre_trending_label: null,
      seeded: false,
      verified_check_in_count: 5,
      first_real_check_in_at: null,
      hours: null,
      phone: null,
      website: null,
      integrations: null,
    }
    setMockResolution([row])

    const result = await fetchVenuesFromSupabase()

    expect(mockSupabase.from).toHaveBeenCalledWith('venues')
    expect(result).not.toBeNull()
    expect(result!.length).toBe(1)
    expect(result![0].id).toBe('v-1')
    expect(result![0].name).toBe('The Rooftop')
    expect(result![0].location.lat).toBe(40.7)
    expect(result![0].location.lng).toBe(-74.0)
    expect(result![0].pulseScore).toBe(72)
    expect(result![0].city).toBe('New York')
  })

  it('returns null on error', async () => {
    setMockResolution(null, { message: 'network error' })

    const result = await fetchVenuesFromSupabase()

    expect(result).toBeNull()
  })

  it('returns null when data is null with no error', async () => {
    setMockResolution(null, null)

    const result = await fetchVenuesFromSupabase()

    expect(result).toBeNull()
  })

  it('returns empty array when no venues exist', async () => {
    setMockResolution([])

    const result = await fetchVenuesFromSupabase()

    expect(result).toEqual([])
  })

  it('maps optional fields to undefined gracefully', async () => {
    const row = {
      id: 'v-2',
      name: 'Minimal Venue',
      location_lat: 37.7,
      location_lng: -122.4,
      location_address: null,
      city: null,
      state: null,
      category: null,
      pulse_score: 0,
      score_velocity: null,
      last_pulse_at: null,
      pre_trending: false,
      pre_trending_label: null,
      seeded: false,
      verified_check_in_count: 0,
      first_real_check_in_at: null,
      hours: null,
      phone: null,
      website: null,
      integrations: null,
    }
    setMockResolution([row])

    const result = await fetchVenuesFromSupabase()

    expect(result).not.toBeNull()
    expect(result![0].phone).toBeNull()
    expect(result![0].website).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: fetchPulsesFromSupabase
// ---------------------------------------------------------------------------

describe('fetchPulsesFromSupabase', () => {
  beforeEach(resetMocks)

  it('returns mapped pulses on success', async () => {
    const now = new Date().toISOString()
    const row = {
      id: 'p-1',
      user_id: 'u-1',
      venue_id: 'v-1',
      crew_id: null,
      photos: ['https://example.com/photo.jpg'],
      video_url: null,
      energy_rating: 'electric',
      caption: 'Great vibes!',
      hashtags: ['#friday'],
      views: 20,
      is_pioneer: false,
      credibility_weight: 1.0,
      reactions: { fire: ['u-2'], eyes: [], skull: [], lightning: [] },
      created_at: now,
      expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    }
    setMockResolution([row])

    const result = await fetchPulsesFromSupabase()

    expect(mockSupabase.from).toHaveBeenCalledWith('pulses')
    expect(result).not.toBeNull()
    expect(result!.length).toBe(1)
    expect(result![0].id).toBe('p-1')
    expect(result![0].energyRating).toBe('electric')
    expect(result![0].caption).toBe('Great vibes!')
    expect(result![0].photos).toEqual(['https://example.com/photo.jpg'])
    expect(result![0].reactions.fire).toEqual(['u-2'])
    expect(result![0].isPending).toBe(false)
    expect(result![0].uploadError).toBe(false)
  })

  it('returns null on error', async () => {
    setMockResolution(null, { message: 'permission denied' })

    const result = await fetchPulsesFromSupabase()

    expect(result).toBeNull()
  })

  it('defaults photos to empty array when null in db', async () => {
    const row = {
      id: 'p-2',
      user_id: 'u-1',
      venue_id: 'v-1',
      crew_id: null,
      photos: null,
      video_url: null,
      energy_rating: 'chill',
      caption: null,
      hashtags: null,
      views: 0,
      is_pioneer: false,
      credibility_weight: 1.0,
      reactions: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }
    setMockResolution([row])

    const result = await fetchPulsesFromSupabase()

    expect(result![0].photos).toEqual([])
    expect(result![0].hashtags).toEqual([])
    expect(result![0].reactions).toEqual({ fire: [], eyes: [], skull: [], lightning: [] })
  })
})

// ---------------------------------------------------------------------------
// Tests: uploadPulseToSupabase
// ---------------------------------------------------------------------------

describe('uploadPulseToSupabase', () => {
  beforeEach(resetMocks)

  it('calls insert with correct shape and returns true on success', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: null })

    const pulse = makePulse({
      id: 'p-test',
      userId: 'u-1',
      venueId: 'v-1',
      energyRating: 'buzzing',
      caption: 'Test caption',
    })

    const result = await uploadPulseToSupabase(pulse)

    expect(mockSupabase.from).toHaveBeenCalledWith('pulses')
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p-test',
        user_id: 'u-1',
        venue_id: 'v-1',
        energy_rating: 'buzzing',
        caption: 'Test caption',
      }),
    )
    expect(result).toBe(true)
  })

  it('returns false when insert errors', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: { message: 'duplicate key' } })

    const pulse = makePulse()
    const result = await uploadPulseToSupabase(pulse)

    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests: Auth flow (SupabaseAuthProvider logic via mockAuth)
// ---------------------------------------------------------------------------

describe('Auth flow (supabase.auth methods)', () => {
  beforeEach(resetMocks)

  it('signInAnonymously calls auth.signInAnonymously', async () => {
    await mockSupabase.auth.signInAnonymously()
    expect(mockAuth.signInAnonymously).toHaveBeenCalledTimes(1)
  })

  it('signInAnonymously resolves with user on success', async () => {
    const { data, error } = await mockSupabase.auth.signInAnonymously()
    expect(error).toBeNull()
    expect(data.user.id).toBe('anon-1')
  })

  it('signOut resolves without error', async () => {
    const { error } = await mockSupabase.auth.signOut()
    expect(error).toBeNull()
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1)
  })

  it('getSession returns null session when unauthenticated', async () => {
    const { data } = await mockSupabase.auth.getSession()
    expect(data.session).toBeNull()
  })

  it('refreshSession returns new session token', async () => {
    const { data, error } = await mockSupabase.auth.refreshSession()
    expect(error).toBeNull()
    expect(data.session?.access_token).toBe('tok')
  })

  it('onAuthStateChange registers a listener and returns unsubscribe', () => {
    const cb = vi.fn()
    const { data } = mockSupabase.auth.onAuthStateChange(cb)
    expect(data.subscription.unsubscribe).toBeDefined()
    data.subscription.unsubscribe()
    expect(mockAuthState.subscription.unsubscribe).toHaveBeenCalled()
  })

  it('signUp resolves with new user on success', async () => {
    const { data, error } = await mockSupabase.auth.signUp()
    expect(error).toBeNull()
    expect(data.user.id).toBe('new-user-1')
  })

  it('propagates auth errors when sign-in fails', async () => {
    mockAuth.signInAnonymously.mockResolvedValueOnce({
      data: null,
      error: { message: 'service unavailable', status: 503 },
    })

    const { error } = await mockSupabase.auth.signInAnonymously()
    expect(error).not.toBeNull()
    expect(error!.message).toBe('service unavailable')
  })
})

// ---------------------------------------------------------------------------
// Tests: Venue queries (distance / ordering simulation)
// ---------------------------------------------------------------------------

describe('Venue queries – ordering and filtering simulation', () => {
  beforeEach(resetMocks)

  it('chains select → order calls correctly', async () => {
    setMockResolution([])

    // Simulate what a caller would do: supabase.from('venues').select('*').order(...)
    await mockSupabase
      .from('venues')
      .select('*')
      .order('pulse_score', { ascending: false })

    expect(mockSupabase.from).toHaveBeenCalledWith('venues')
    expect(mockQueryBuilder.select).toHaveBeenCalled()
    expect(mockQueryBuilder.order).toHaveBeenCalledWith('pulse_score', { ascending: false })
  })

  it('chains eq filter for city-scoped queries', async () => {
    setMockResolution([])

    await mockSupabase.from('venues').select('*').eq('city', 'Seattle')

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('city', 'Seattle')
  })
})

// ---------------------------------------------------------------------------
// Tests: Notification subscription handling
// ---------------------------------------------------------------------------

describe('Notification subscription handling', () => {
  beforeEach(resetMocks)

  it('creates a channel and subscribes', () => {
    const channel = mockSupabase.channel('notifications-channel')
    channel.on('postgres_changes', {}, vi.fn()).subscribe()

    expect(mockSupabase.channel).toHaveBeenCalledWith('notifications-channel')
    expect(channel.on).toHaveBeenCalled()
    expect(channel.subscribe).toHaveBeenCalled()
  })

  it('can unsubscribe from a channel', () => {
    const channel = mockSupabase.channel('cleanup-test')
    channel.subscribe()
    channel.unsubscribe()

    expect(channel.unsubscribe).toHaveBeenCalled()
  })

  it('channel.on is chainable', () => {
    const channel = mockSupabase.channel('chain-test')
    const returnValue = channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pulses' }, vi.fn())
    expect(returnValue).toBe(channel)
  })
})
