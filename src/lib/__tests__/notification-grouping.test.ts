import { describe, it, expect } from 'vitest'
import { groupNotifications } from '../notification-grouping'
import type { NotificationWithData } from '../types'

function makeNotification(overrides: Partial<NotificationWithData>): NotificationWithData {
  return {
    id: `notif-${Math.random().toString(36).slice(2)}`,
    type: 'friend_pulse',
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  }
}

describe('groupNotifications', () => {
  it('groups reactions on the same pulse together', () => {
    const now = new Date()
    const notifications: NotificationWithData[] = [
      makeNotification({
        type: 'pulse_reaction',
        pulseId: 'pulse-1',
        reactionType: 'fire',
        user: { id: 'u-2', username: 'alice', friends: [], createdAt: now.toISOString() },
        createdAt: new Date(now.getTime() - 1000).toISOString(),
      }),
      makeNotification({
        type: 'pulse_reaction',
        pulseId: 'pulse-1',
        reactionType: 'lightning',
        user: { id: 'u-3', username: 'bob', friends: [], createdAt: now.toISOString() },
        createdAt: now.toISOString(),
      }),
    ]

    const result = groupNotifications(notifications, {
      groupReactions: true,
      groupFriendPulses: false,
      groupTrendingVenues: false,
    })

    // Two reactions on same pulse should collapse into 1 grouped notification
    expect(result.length).toBe(1)
    expect(result[0].count).toBe(2)
    expect(result[0].groupedReactionTypes).toContain('fire')
    expect(result[0].groupedReactionTypes).toContain('lightning')
  })

  it('does not group reactions when preference is off', () => {
    const notifications: NotificationWithData[] = [
      makeNotification({ type: 'pulse_reaction', pulseId: 'pulse-1', reactionType: 'fire' }),
      makeNotification({ type: 'pulse_reaction', pulseId: 'pulse-1', reactionType: 'eyes' }),
    ]

    const result = groupNotifications(notifications, {
      groupReactions: false,
      groupFriendPulses: false,
      groupTrendingVenues: false,
    })

    expect(result.length).toBe(2)
  })

  it('sorts grouped notifications newest first', () => {
    const now = new Date()
    const older = new Date(now.getTime() - 60 * 60 * 1000)
    const notifications: NotificationWithData[] = [
      makeNotification({ type: 'friend_pulse', createdAt: older.toISOString(), venueId: 'v-1' }),
      makeNotification({ type: 'pulse_reaction', pulseId: 'p-1', reactionType: 'fire', createdAt: now.toISOString() }),
    ]

    const result = groupNotifications(notifications, {
      groupReactions: true,
      groupFriendPulses: false,
      groupTrendingVenues: false,
    })

    expect(new Date(result[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(result[result.length - 1].createdAt).getTime()
    )
  })

  it('keeps different pulse reactions separate', () => {
    const notifications: NotificationWithData[] = [
      makeNotification({ type: 'pulse_reaction', pulseId: 'pulse-1', reactionType: 'fire' }),
      makeNotification({ type: 'pulse_reaction', pulseId: 'pulse-2', reactionType: 'fire' }),
    ]

    const result = groupNotifications(notifications, {
      groupReactions: true,
      groupFriendPulses: false,
      groupTrendingVenues: false,
    })

    expect(result.length).toBe(2)
  })

  it('does not deduplicate same user reacting twice', () => {
    const user = { id: 'u-2', username: 'alice', friends: [], createdAt: new Date().toISOString() }
    const notifications: NotificationWithData[] = [
      makeNotification({ type: 'pulse_reaction', pulseId: 'pulse-1', reactionType: 'fire', user }),
      makeNotification({ type: 'pulse_reaction', pulseId: 'pulse-1', reactionType: 'eyes', user }),
    ]

    const result = groupNotifications(notifications, {
      groupReactions: true,
      groupFriendPulses: false,
      groupTrendingVenues: false,
    })

    expect(result.length).toBe(1)
    // groupedUsers should only contain the user once
    expect(result[0].groupedUsers?.length).toBe(1)
  })
})
