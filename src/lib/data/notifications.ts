/**
 * Notifications queries for the signed-in user.
 *
 * RLS blocks read of other users' rows, so all reads implicitly scope to
 * the current session. We still pass `auth.uid()` filters explicitly so
 * query plans stay tight.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { fromAlive, unwrap } from '@/lib/auth/rls-helpers'
import type { Notification, NotificationType } from '@/lib/types'

interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType
  pulse_id: string | null
  venue_id: string | null
  reaction_type: string | null
  energy_threshold: string | null
  recommended_venue_id: string | null
  read: boolean
  created_at: string
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    pulseId: row.pulse_id ?? undefined,
    venueId: row.venue_id ?? undefined,
    reactionType: (row.reaction_type as Notification['reactionType']) ?? undefined,
    energyThreshold: (row.energy_threshold as Notification['energyThreshold']) ?? undefined,
    recommendedVenueId: row.recommended_venue_id ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS = `
  id, user_id, type, pulse_id, venue_id, reaction_type,
  energy_threshold, recommended_venue_id, read, created_at
`.trim()

export async function listMyNotifications(limit = 100): Promise<Notification[]> {
  const userId = await requireUserId()
  const result = await fromAlive('notifications', SELECT_COLUMNS, { includeDeleted: true })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = unwrap<NotificationRow[]>(result)
  return rows.map(rowToNotification)
}

export async function countUnreadNotifications(): Promise<number> {
  const userId = await requireUserId()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  const userId = await requireUserId()
  const result = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', userId)
  if (result.error) throw result.error
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId()
  const result = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (result.error) throw result.error
}
