import { describe, expect, it } from 'vitest'
import {
  inAppNotifyHref,
  mergeOwnerReplyNotices,
  unreadYouBadgeCount,
  youTabAriaLabel,
} from '../in-app-notify'
import type { Notification } from '../types'

function row(overrides: Partial<Notification>): Notification {
  return {
    id: overrides.id ?? 'n1',
    type: overrides.type ?? 'friend_pulse',
    userId: 'me',
    createdAt: overrides.createdAt ?? '2026-10-01T04:00:00.000Z',
    read: overrides.read ?? false,
    venueId: overrides.venueId,
    pulseId: overrides.pulseId,
    ...overrides,
  }
}

describe('in-app notification targets', () => {
  it('deep-links surges and friend pulses to the venue, replies to the inbox', () => {
    expect(inAppNotifyHref({ type: 'venue_surge', venueId: 'neumos' })).toBe('/venue/neumos?highlight=surge')
    expect(inAppNotifyHref({ type: 'friend_pulse', venueId: 'neumos', pulseId: 'p1' })).toBe(
      '/venue/neumos?highlight=pulse&pulse=p1',
    )
    expect(inAppNotifyHref({ type: 'owner_reply', venueId: 'neumos' })).toBe('/venue/neumos/inbox?highlight=reply')
    expect(inAppNotifyHref({ type: 'wave' })).toBeNull()
  })

  it('counts one unread badge for a surge storm', () => {
    const now = '2026-10-01T04:10:00.000Z'
    const count = unreadYouBadgeCount([
      row({ id: 'a', type: 'venue_surge', venueId: 'neumos', createdAt: now }),
      row({ id: 'b', type: 'venue_surge', venueId: 'neumos', createdAt: now }),
      row({ id: 'c', type: 'owner_reply', venueId: 'barboza', createdAt: now, read: true }),
    ])
    expect(count).toBe(1)
    expect(youTabAriaLabel(1)).toBe('You, 1 unread')
    expect(youTabAriaLabel(0)).toBe('You')
  })

  it('does not append the same owner reply twice', () => {
    const reply = { id: 'r1', venueId: 'neumos', pulseId: 'p1', createdAt: '2026-10-01T04:00:00.000Z' }
    const once = mergeOwnerReplyNotices([], [reply])
    const twice = mergeOwnerReplyNotices(once, [reply, reply])
    expect(twice).toHaveLength(1)
    expect(twice[0].type).toBe('owner_reply')
    expect(twice[0].venueId).toBe('neumos')
  })
})
