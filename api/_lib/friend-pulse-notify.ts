/**
 * Notify a user's friends when they post a new pulse.
 *
 * Uses the service-role client to:
 *   1. Resolve friend ids (forward + reverse `profiles.friends`)
 *   2. Respect `profiles.notification_settings.friendPulses`
 *   3. Insert durable `notifications` rows
 *   4. Fan out native + realtime push via `dispatchUserNotification`
 *
 * Never throws — safe to fire-and-forget from pulse create.
 */

import { createAdminClient } from './supabase-server'
import { dispatchUserNotification } from './dispatch-notification'
import { isFriendPulsesEnabled, mergeNotificationSettings } from './notification-settings'

export interface FriendPulseNotifyInput {
  posterUserId: string
  pulseId: string
  venueId: string
}

export interface FriendPulseNotifyResult {
  notified: number
  skipped: number
}

type LoggerLike = {
  warn: (msg: string, meta?: Record<string, unknown>) => void
}

const defaultLogger: LoggerLike = {
  warn: (msg, meta) => console.warn('[friend-pulse-notify]', msg, meta ?? {}),
}

export async function notifyFriendsOfPulse(
  input: FriendPulseNotifyInput,
  logger: LoggerLike = defaultLogger,
): Promise<FriendPulseNotifyResult> {
  const admin = createAdminClient()
  if (!admin) return { notified: 0, skipped: 0 }

  try {
    const { data: poster, error: posterErr } = await admin
      .from('profiles')
      .select('friends, display_name, username')
      .eq('id', input.posterUserId)
      .maybeSingle()

    if (posterErr) {
      logger.warn('poster lookup failed', { error: posterErr.message })
      return { notified: 0, skipped: 0 }
    }

    const candidateIds = new Set<string>()
    for (const id of poster?.friends ?? []) {
      const s = String(id)
      if (s && s !== input.posterUserId) candidateIds.add(s)
    }

    const { data: reverseFriends } = await admin
      .from('profiles')
      .select('id')
      .contains('friends', [input.posterUserId])

    for (const row of reverseFriends ?? []) {
      if (row.id && row.id !== input.posterUserId) candidateIds.add(row.id)
    }

    if (candidateIds.size === 0) return { notified: 0, skipped: 0 }

    const ids = [...candidateIds]
    const { data: friendProfiles } = await admin
      .from('profiles')
      .select('id, notification_settings')
      .in('id', ids)

    const { data: venue } = await admin
      .from('venues')
      .select('name')
      .eq('id', input.venueId)
      .maybeSingle()

    const posterName = poster?.display_name ?? poster?.username ?? 'A friend'
    const venueName = venue?.name ?? 'a venue'
    const title = `${posterName} posted a pulse`
    const body = `Check out ${venueName}`

    let notified = 0
    let skipped = 0

    for (const friend of friendProfiles ?? []) {
      if (!isFriendPulsesEnabled(friend.notification_settings)) {
        skipped += 1
        continue
      }

      const { error: insertErr } = await admin.from('notifications').insert({
        user_id: friend.id,
        type: 'friend_pulse',
        pulse_id: input.pulseId,
        venue_id: input.venueId,
        read: false,
      })

      if (insertErr) {
        logger.warn('notification insert failed', {
          friendId: friend.id,
          error: insertErr.message,
        })
        skipped += 1
        continue
      }

      void dispatchUserNotification({
        userId: friend.id,
        title,
        body,
        data: {
          kind: 'friend_pulse',
          pulseId: input.pulseId,
          venueId: input.venueId,
          fromUserId: input.posterUserId,
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
export { mergeNotificationSettings }
