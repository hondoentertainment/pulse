/**
 * Notify friends when a user checks in at a venue.
 * Respects `profiles.notification_settings.friendNearbyVenues`.
 */

import { createAdminClient } from './supabase-server'
import { dispatchUserNotification } from './dispatch-notification'
import { isFriendNearbyVenuesEnabled } from './notification-settings'

export interface FriendNearbyNotifyInput {
  userId: string
  venueId: string
}

function isFriendNearbyEnabled(raw: unknown): boolean {
  return isFriendNearbyVenuesEnabled(raw)
}

type LoggerLike = {
  warn: (msg: string, meta?: Record<string, unknown>) => void
}

const defaultLogger: LoggerLike = {
  warn: (msg, meta) => console.warn('[friend-nearby-notify]', msg, meta ?? {}),
}

export async function notifyFriendsOfCheckIn(
  input: FriendNearbyNotifyInput,
  logger: LoggerLike = defaultLogger,
): Promise<{ notified: number; skipped: number }> {
  const admin = createAdminClient()
  if (!admin) return { notified: 0, skipped: 0 }

  try {
    const { data: user, error: userErr } = await admin
      .from('profiles')
      .select('friends, display_name, username')
      .eq('id', input.userId)
      .maybeSingle()

    if (userErr) {
      logger.warn('user lookup failed', { error: userErr.message })
      return { notified: 0, skipped: 0 }
    }

    const candidateIds = new Set<string>()
    for (const id of user?.friends ?? []) {
      const s = String(id)
      if (s && s !== input.userId) candidateIds.add(s)
    }

    const { data: reverseFriends } = await admin
      .from('profiles')
      .select('id')
      .contains('friends', [input.userId])

    for (const row of reverseFriends ?? []) {
      if (row.id && row.id !== input.userId) candidateIds.add(row.id)
    }

    if (candidateIds.size === 0) return { notified: 0, skipped: 0 }

    const [{ data: venue }, { data: friendProfiles }] = await Promise.all([
      admin.from('venues').select('name').eq('id', input.venueId).maybeSingle(),
      admin
        .from('profiles')
        .select('id, notification_settings')
        .in('id', [...candidateIds]),
    ])

    const userName = user?.display_name ?? user?.username ?? 'A friend'
    const venueName = venue?.name ?? 'a venue'
    const title = `${userName} is nearby`
    const body = `Checked in at ${venueName}`

    let notified = 0
    let skipped = 0

    for (const friend of friendProfiles ?? []) {
      if (!isFriendNearbyEnabled(friend.notification_settings)) {
        skipped += 1
        continue
      }

      const { error: insertErr } = await admin.from('notifications').insert({
        user_id: friend.id,
        type: 'friend_nearby',
        venue_id: input.venueId,
        read: false,
      })

      if (insertErr) {
        logger.warn('notification insert failed', { friendId: friend.id, error: insertErr.message })
        skipped += 1
        continue
      }

      void dispatchUserNotification({
        userId: friend.id,
        title,
        body,
        data: {
          kind: 'friend_nearby',
          venueId: input.venueId,
          fromUserId: input.userId,
        },
      }).catch((err) => {
        logger.warn('push dispatch failed', {
          friendId: friend.id,
          error: err instanceof Error ? err.message : String(err),
        })
      })

      notified += 1
    }

    return { notified, skipped }
  } catch (err) {
    logger.warn('unexpected failure', { error: err instanceof Error ? err.message : String(err) })
    return { notified: 0, skipped: 0 }
  }
}

/** Exported for tests. */
export { isFriendNearbyEnabled }
