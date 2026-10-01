/**
 * WC-4 in-app notification targets.
 * Venue surges, friend pulses, and owner replies deep-link with a highlight.
 * Grouping itself lives in notification-grouping so storms collapse to one row.
 */

import type { GroupedNotification, Notification } from '@/lib/types'
import { groupNotifications } from '@/lib/notification-grouping'

export type NotifyHighlight = 'surge' | 'pulse' | 'reply'

export function inAppNotifyHref(notification: {
  type: string
  venueId?: string
  pulseId?: string
}): string | null {
  const venueId = notification.venueId
  if (!venueId) return null
  const venue = encodeURIComponent(venueId)
  if (notification.type === 'owner_reply') {
    return `/venue/${venue}/inbox?highlight=reply`
  }
  if (notification.type === 'venue_surge') {
    return `/venue/${venue}?highlight=surge`
  }
  if (notification.type === 'friend_pulse') {
    const pulse = notification.pulseId
      ? `&pulse=${encodeURIComponent(notification.pulseId)}`
      : ''
    return `/venue/${venue}?highlight=pulse${pulse}`
  }
  return null
}

/** Unread groups, not raw rows, so a surge storm is one badge. */
export function unreadYouBadgeCount(notifications: readonly Notification[]): number {
  const grouped = groupNotifications(notifications as GroupedNotification[], {
    groupReactions: true,
    groupFriendPulses: true,
    groupTrendingVenues: true,
  })
  return grouped.filter((row) => !row.read).length
}

export function youTabAriaLabel(unread: number): string {
  if (unread <= 0) return 'You'
  return `You, ${unread} unread`
}

export interface OwnerReplyNoticeInput {
  id: string
  venueId: string
  pulseId: string
  createdAt: string
}

/** One in-app row per owner reply. Repeat loads do not append another copy. */
export function mergeOwnerReplyNotices(
  current: readonly Notification[],
  replies: readonly OwnerReplyNoticeInput[],
): Notification[] {
  const seen = new Set(current.map((row) => row.id))
  const next = [...current]
  for (const reply of replies) {
    const id = `owner-reply-${reply.id}`
    if (!reply.venueId || seen.has(id)) continue
    seen.add(id)
    next.unshift({
      id,
      type: 'owner_reply',
      userId: 'venue-owner',
      pulseId: reply.pulseId,
      venueId: reply.venueId,
      createdAt: reply.createdAt,
      read: false,
    })
  }
  return next
}
