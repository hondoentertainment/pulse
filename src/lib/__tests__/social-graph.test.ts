import { describe, it, expect } from 'vitest'
import {
  getPeopleYouMayKnow,
  formatSuggestionReason,
  generateActivityDigest,
  createFriendInviteLink,
  createVenueShareLink,
  generateFriendQRPayload,
  parseFriendQRPayload,
} from '../social-graph'
import type { User, Pulse } from '../types'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'testuser',
    friends: [],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random()}`,
    userId: 'user-1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('getPeopleYouMayKnow', () => {
  it('returns empty when no candidates', () => {
    const me = makeUser({ id: 'me' })
    expect(getPeopleYouMayKnow(me, [me], [])).toEqual([])
  })

  it('finds co-located users', () => {
    const me = makeUser({ id: 'me' })
    const other = makeUser({ id: 'other', username: 'other' })
    const now = Date.now()
    const pulses = [
      makePulse({ userId: 'me', venueId: 'v1', createdAt: new Date(now - 10 * 60000).toISOString() }),
      makePulse({ userId: 'other', venueId: 'v1', createdAt: new Date(now - 15 * 60000).toISOString() }),
    ]
    const suggestions = getPeopleYouMayKnow(me, [me, other], pulses)
    expect(suggestions.length).toBe(1)
    expect(suggestions[0].user.id).toBe('other')
    expect(suggestions[0].reason.type).toBe('co_located')
  })

  it('finds users with mutual friends', () => {
    const me = makeUser({ id: 'me', friends: ['friend-1', 'friend-2'] })
    const other = makeUser({ id: 'other', username: 'other', friends: ['friend-1', 'friend-2', 'friend-3'] })
    const suggestions = getPeopleYouMayKnow(me, [me, other], [])
    expect(suggestions.length).toBe(1)
    expect(suggestions[0].reason.type).toBe('mutual_friends')
  })

  it('excludes existing friends', () => {
    const me = makeUser({ id: 'me', friends: ['other'] })
    const other = makeUser({ id: 'other', username: 'other' })
    const pulses = [
      makePulse({ userId: 'me', venueId: 'v1' }),
      makePulse({ userId: 'other', venueId: 'v1' }),
    ]
    expect(getPeopleYouMayKnow(me, [me, other], pulses)).toEqual([])
  })

  it('respects limit', () => {
    const me = makeUser({ id: 'me', friends: ['shared'] })
    const users = Array.from({ length: 20 }, (_, i) =>
      makeUser({ id: `u-${i}`, username: `user${i}`, friends: ['shared'] })
    )
    const suggestions = getPeopleYouMayKnow(me, [me, ...users], [], 90, 5)
    expect(suggestions.length).toBeLessThanOrEqual(5)
  })
})

describe('formatSuggestionReason', () => {
  it('formats co_located', () => {
    expect(formatSuggestionReason({ type: 'co_located', venueCount: 1 })).toContain('same venue')
  })
  it('formats mutual_friends', () => {
    expect(formatSuggestionReason({ type: 'mutual_friends', count: 3 })).toContain('3 mutual friends')
  })
  it('formats same_venues', () => {
    expect(formatSuggestionReason({ type: 'same_venues', venueCount: 2 })).toContain('2 same spots')
  })
})

describe('generateActivityDigest', () => {
  it('returns empty entries when no friend activity', () => {
    const me = makeUser({ id: 'me', friends: [] })
    const digest = generateActivityDigest(me, [], [], [])
    expect(digest.entries).toEqual([])
  })

  it('groups friend activity by user', () => {
    const me = makeUser({ id: 'me', friends: ['f1'] })
    const friend = makeUser({ id: 'f1', username: 'alice' })
    const venues = [{ id: 'v1', name: 'Bar A' }, { id: 'v2', name: 'Cafe B' }]
    const pulses = [
      makePulse({ userId: 'f1', venueId: 'v1' }),
      makePulse({ userId: 'f1', venueId: 'v2' }),
    ]
    const digest = generateActivityDigest(me, [me, friend], pulses, venues)
    expect(digest.entries.length).toBe(1)
    expect(digest.entries[0].venues.length).toBe(2)
  })

  it('excludes non-friend activity', () => {
    const me = makeUser({ id: 'me', friends: ['f1'] })
    const stranger = makeUser({ id: 'stranger', username: 'bob' })
    const venues = [{ id: 'v1', name: 'Bar A' }]
    const pulses = [makePulse({ userId: 'stranger', venueId: 'v1' })]
    const digest = generateActivityDigest(me, [me, stranger], pulses, venues)
    expect(digest.entries.length).toBe(0)
  })
})

describe('createFriendInviteLink', () => {
  it('creates a valid invite link', () => {
    const link = createFriendInviteLink('user-1')
    expect(link.type).toBe('friend_invite')
    expect(link.url).toContain('/invite/')
    expect(link.code.length).toBe(8)
    expect(link.referralId).toContain('user-1')
  })
})

describe('createVenueShareLink', () => {
  it('creates a valid venue share link', () => {
    const link = createVenueShareLink('v1', 'user-1')
    expect(link.type).toBe('venue_share')
    expect(link.url).toContain('/venue/v1')
  })
})

describe('QR payload', () => {
  it('generates and parses QR payload', () => {
    const payload = generateFriendQRPayload('u1', 'alice')
    const parsed = parseFriendQRPayload(payload)
    expect(parsed).toEqual({ userId: 'u1', username: 'alice' })
  })

  it('returns null for invalid payload', () => {
    expect(parseFriendQRPayload('invalid')).toBeNull()
  })

  it('returns null for expired QR', () => {
    const data = JSON.stringify({
      type: 'pulse_friend_add',
      userId: 'u1',
      username: 'alice',
      ts: Date.now() - 10 * 60 * 1000, // 10 min ago
    })
    expect(parseFriendQRPayload(data)).toBeNull()
  })
})
