import { describe, expect, it, vi } from 'vitest'
import type { User as AuthUser } from '@supabase/supabase-js'
import {
  createFallbackProfile,
  deriveUsername,
  fetchOrCreateProfile,
  mapProfileRowToPulseUser,
  type ProfileRow,
} from '../auth-profile'

function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: '12345678-1234-1234-1234-123456abcdef',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-04-22T00:00:00.000Z',
    email: 'night.owl@example.com',
    ...overrides,
  } as AuthUser
}

function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: '12345678-1234-1234-1234-123456abcdef',
    username: 'night_owl_123456',
    profile_photo_url: 'https://example.com/avatar.png',
    friends: ['friend-1'],
    favorite_venues: ['venue-1'],
    followed_venues: ['venue-2'],
    favorite_categories: ['dance'],
    credibility_score: 0.9,
    presence_settings: { enabled: true, visibility: 'friends', hideAtSensitiveVenues: false },
    venue_check_in_history: { 'venue-1': 2 },
    post_streak: 3,
    last_post_date: '2026-04-21',
    created_at: '2026-04-20T00:00:00.000Z',
    ...overrides,
  }
}

function createMockClient(options: {
  existingRow?: ProfileRow | null
  selectError?: Error | null
  insertedRow?: ProfileRow | null
  insertError?: Error | null
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.existingRow ?? null,
    error: options.selectError ?? null,
  })
  const eq = vi.fn(() => ({ maybeSingle }))
  const selectExisting = vi.fn(() => ({ eq }))

  const single = vi.fn().mockResolvedValue({
    data: options.insertedRow ?? null,
    error: options.insertError ?? null,
  })
  const selectInserted = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select: selectInserted }))

  const from = vi.fn(() => ({
    select: selectExisting,
    insert,
  }))

  return {
    client: { from },
    spies: { from, selectExisting, eq, maybeSingle, insert, selectInserted, single },
  }
}

describe('deriveUsername', () => {
  it('prefers auth metadata and appends a unique suffix', () => {
    const username = deriveUsername(makeAuthUser({
      user_metadata: { user_name: 'Night Owl' },
    }))

    expect(username).toBe('night_owl_123456')
  })

  it('falls back to the email prefix when metadata is missing', () => {
    const username = deriveUsername(makeAuthUser({
      user_metadata: {},
      email: 'after.hours@example.com',
    }))

    expect(username).toBe('after_hours_123456')
  })
})

describe('createFallbackProfile', () => {
  it('creates a safe default profile from auth data', () => {
    const profile = createFallbackProfile(makeAuthUser({
      user_metadata: {
        avatar_url: 'https://example.com/nightowl.png',
      },
    }))

    expect(profile.id).toBe('12345678-1234-1234-1234-123456abcdef')
    expect(profile.username).toBe('night_owl_123456')
    expect(profile.profilePhoto).toBe('https://example.com/nightowl.png')
    expect(profile.friends).toEqual([])
    expect(profile.favoriteVenues).toEqual([])
    expect(profile.presenceSettings).toEqual({
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: false,
    })
  })
})

describe('mapProfileRowToPulseUser', () => {
  it('maps Supabase row fields into the app user shape', () => {
    const user = mapProfileRowToPulseUser(makeProfileRow())

    expect(user.favoriteVenues).toEqual(['venue-1'])
    expect(user.followedVenues).toEqual(['venue-2'])
    expect(user.venueCheckInHistory).toEqual({ 'venue-1': 2 })
    expect(user.postStreak).toBe(3)
  })

  it('normalizes nullable profile fields into safe defaults', () => {
    const user = mapProfileRowToPulseUser(makeProfileRow({
      profile_photo_url: null,
      friends: null,
      favorite_venues: null,
      followed_venues: null,
      favorite_categories: null,
      credibility_score: null,
      presence_settings: null,
      venue_check_in_history: null,
      post_streak: null,
      last_post_date: null,
    }))

    expect(user.profilePhoto).toBeUndefined()
    expect(user.friends).toEqual([])
    expect(user.favoriteVenues).toEqual([])
    expect(user.followedVenues).toEqual([])
    expect(user.favoriteCategories).toEqual([])
    expect(user.credibilityScore).toBe(1)
    expect(user.presenceSettings).toEqual({
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: false,
    })
    expect(user.venueCheckInHistory).toEqual({})
    expect(user.postStreak).toBe(0)
    expect(user.lastPostDate).toBeUndefined()
  })
})

describe('fetchOrCreateProfile', () => {
  it('returns the existing profile when one is present', async () => {
    const row = makeProfileRow()
    const { client, spies } = createMockClient({ existingRow: row })

    const profile = await fetchOrCreateProfile(client as never, makeAuthUser({
      user_metadata: {
        avatar_url: 'https://example.com/nightowl.png',
      },
    }))

    expect(profile.username).toBe(row.username)
    expect(spies.insert).not.toHaveBeenCalled()
  })

  it('creates a profile when the auth user is new', async () => {
    const insertedRow = makeProfileRow({
      friends: [],
      favorite_venues: [],
      followed_venues: [],
      favorite_categories: [],
      credibility_score: 1,
      post_streak: 0,
      last_post_date: null,
      venue_check_in_history: {},
    })
    const { client, spies } = createMockClient({ existingRow: null, insertedRow })

    const profile = await fetchOrCreateProfile(client as never, makeAuthUser({
      user_metadata: {
        avatar_url: 'https://example.com/nightowl.png',
      },
    }))

    expect(spies.insert).toHaveBeenCalledTimes(1)
    expect(spies.insert).toHaveBeenCalledWith({
      id: '12345678-1234-1234-1234-123456abcdef',
      username: 'night_owl_123456',
      profile_photo_url: 'https://example.com/nightowl.png',
      friends: [],
      favorite_venues: [],
      followed_venues: [],
      favorite_categories: [],
      credibility_score: 1,
      presence_settings: {
        enabled: true,
        visibility: 'everyone',
        hideAtSensitiveVenues: false,
      },
      venue_check_in_history: {},
      post_streak: 0,
      last_post_date: null,
      created_at: expect.any(String),
    })
    expect(profile.username).toBe(insertedRow.username)
    expect(profile.favoriteVenues).toEqual([])
  })

  it('falls back to a synthesized local profile when insert fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = createMockClient({
      existingRow: null,
      insertedRow: null,
      insertError: new Error('insert failed'),
    })

    const profile = await fetchOrCreateProfile(client as never, makeAuthUser())

    expect(profile.id).toBe('12345678-1234-1234-1234-123456abcdef')
    expect(profile.username).toBe('night_owl_123456')
    expect(profile.friends).toEqual([])
    consoleErrorSpy.mockRestore()
  })
})
