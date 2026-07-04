/**
 * Notify a pulse author when someone reacts to their pulse.
 * Respects `profiles.notification_settings.pulseReactions`.
 */

import { createAdminClient } from './supabase-server'
import { dispatchUserNotification } from './dispatch-notification'
import { isPulseReactionsEnabled } from './notification-settings'

export interface PulseReactionNotifyInput {
  pulseId: string
  reactorUserId: string
  reactionType: 'fire' | 'eyes' | 'skull' | 'lightning'
}

const REACTION_LABELS: Record<PulseReactionNotifyInput['reactionType'], string> = {
  fire: '🔥',
  eyes: '👀',
  skull: '💀',
  lightning: '⚡',
}

type LoggerLike = {
  warn: (msg: string, meta?: Record<string, unknown>) => void
}

const defaultLogger: LoggerLike = {
  warn: (msg, meta) => console.warn('[pulse-reaction-notify]', msg, meta ?? {}),
}

export async function notifyPulseAuthorOfReaction(
  input: PulseReactionNotifyInput,
  logger: LoggerLike = defaultLogger,
): Promise<{ notified: boolean }> {
  const admin = createAdminClient()
  if (!admin) return { notified: false }

  try {
    const { data: pulse, error: pulseErr } = await admin
      .from('pulses')
      .select('user_id, venue_id')
      .eq('id', input.pulseId)
      .is('deleted_at', null)
      .maybeSingle()

    if (pulseErr || !pulse?.user_id) {
      logger.warn('pulse lookup failed', { error: pulseErr?.message })
      return { notified: false }
    }

    const authorId = pulse.user_id
    if (authorId === input.reactorUserId) return { notified: false }

    const { data: author } = await admin
      .from('profiles')
      .select('notification_settings')
      .eq('id', authorId)
      .maybeSingle()

    if (!isPulseReactionsEnabled(author?.notification_settings)) {
      return { notified: false }
    }

    const [{ data: reactor }, { data: venue }] = await Promise.all([
      admin
        .from('profiles')
        .select('display_name, username')
        .eq('id', input.reactorUserId)
        .maybeSingle(),
      admin.from('venues').select('name').eq('id', pulse.venue_id).maybeSingle(),
    ])

    const reactorName = reactor?.display_name ?? reactor?.username ?? 'Someone'
    const venueName = venue?.name ?? 'a venue'
    const emoji = REACTION_LABELS[input.reactionType]
    const title = `${reactorName} reacted ${emoji}`
    const body = `Your pulse at ${venueName} got a new reaction`

    const { error: insertErr } = await admin.from('notifications').insert({
      user_id: authorId,
      type: 'pulse_reaction',
      pulse_id: input.pulseId,
      venue_id: pulse.venue_id,
      reaction_type: input.reactionType,
      read: false,
    })

    if (insertErr) {
      logger.warn('notification insert failed', { error: insertErr.message })
      return { notified: false }
    }

    void dispatchUserNotification({
      userId: authorId,
      title,
      body,
      data: {
        kind: 'pulse_reaction',
        pulseId: input.pulseId,
        venueId: pulse.venue_id,
        fromUserId: input.reactorUserId,
        reactionType: input.reactionType,
      },
    }).catch((err) => {
      logger.warn('push dispatch failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })

    return { notified: true }
  } catch (err) {
    logger.warn('unexpected failure', { error: err instanceof Error ? err.message : String(err) })
    return { notified: false }
  }
}
