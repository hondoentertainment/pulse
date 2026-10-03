/**
 * Verified-owner replies stored in venue_owner_replies.
 * Patrons read them on Live now. Pending claims cannot insert (RLS).
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import type { OwnerInboxReply } from '@/lib/owner-inbox'

interface ReplyRow {
  id: string
  pulse_id: string
  venue_id: string
  user_id: string
  body: string
  created_at: string
}

function rowToReply(row: ReplyRow): OwnerInboxReply {
  return {
    id: row.id,
    pulseId: row.pulse_id,
    venueId: row.venue_id,
    body: row.body,
    createdAt: row.created_at,
  }
}

export async function listOwnerRepliesForVenue(venueId: string): Promise<OwnerInboxReply[]> {
  if (!venueId) return []
  const { data, error } = await supabase
    .from('venue_owner_replies')
    .select('id, pulse_id, venue_id, user_id, body, created_at')
    .eq('venue_id', venueId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error || !data) return []
  return (data as ReplyRow[]).map(rowToReply)
}

export async function createOwnerReplyOnServer(input: {
  pulseId: string
  venueId: string
  body: string
}): Promise<OwnerInboxReply | null> {
  try {
    const userId = await requireUserId({ action: 'reply as the venue' })
    const { data, error } = await supabase
      .from('venue_owner_replies')
      .insert({
        pulse_id: input.pulseId,
        venue_id: input.venueId,
        user_id: userId,
        body: input.body.trim(),
      })
      .select('id, pulse_id, venue_id, user_id, body, created_at')
      .single()
    if (error || !data) return null
    return rowToReply(data as ReplyRow)
  } catch {
    return null
  }
}
