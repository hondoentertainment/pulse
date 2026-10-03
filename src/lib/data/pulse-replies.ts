import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { unwrap } from '@/lib/auth/rls-helpers'
import { PULSE_REPLY_BODY, sanitizePulseReplyBody, type PulseReply } from '@/lib/pulse-thread'

interface ReplyRow {
  id: string
  pulse_id: string
  venue_id: string
  user_id: string
  body: string
  created_at: string
}

function rowToReply(row: ReplyRow): PulseReply {
  return {
    id: row.id,
    pulseId: row.pulse_id,
    venueId: row.venue_id,
    userId: row.user_id,
    body: sanitizePulseReplyBody(row.body),
    createdAt: row.created_at,
  }
}

export async function listRepliesForVenue(venueId: string): Promise<PulseReply[]> {
  const { data, error } = await supabase
    .from('pulse_replies')
    .select('id, pulse_id, venue_id, user_id, body, created_at')
    .eq('venue_id', venueId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error || !data) return []
  return (data as ReplyRow[]).map(rowToReply)
}

export async function createPulseReply(input: {
  pulseId: string
  venueId: string
  body?: string
}): Promise<PulseReply> {
  const userId = await requireUserId({ action: 'reply to this pulse' })
  const gate = await supabase.rpc('assert_pulse_reply_rate_limit', {
    p_user_id: userId,
    p_venue_id: input.venueId,
  })
  if (gate.error) {
    throw Object.assign(new Error(gate.error.message), { cause: gate.error })
  }
  const result = await supabase
    .from('pulse_replies')
    .insert({
      pulse_id: input.pulseId,
      venue_id: input.venueId,
      user_id: userId,
      body: sanitizePulseReplyBody(input.body ?? PULSE_REPLY_BODY),
    })
    .select('id, pulse_id, venue_id, user_id, body, created_at')
    .single()
  return rowToReply(unwrap<ReplyRow>(result))
}
