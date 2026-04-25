/**
 * Reactions backed by the normalised `reactions` table.
 *
 * Writes are idempotent: posting the same reaction twice is a no-op
 * thanks to the (pulse_id, user_id, reaction_type) unique constraint.
 * Removal is a soft-delete so audit trails and rate-limit heuristics stay
 * consistent.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { fromAlive, unwrap } from '@/lib/auth/rls-helpers'

export type ReactionType = 'fire' | 'eyes' | 'skull' | 'lightning'

export interface Reaction {
  id: string
  pulseId: string
  userId: string
  reactionType: ReactionType
  createdAt: string
}

interface ReactionRow {
  id: string
  pulse_id: string
  user_id: string
  reaction_type: ReactionType
  created_at: string
  deleted_at: string | null
}

function rowToReaction(row: ReactionRow): Reaction {
  return {
    id: row.id,
    pulseId: row.pulse_id,
    userId: row.user_id,
    reactionType: row.reaction_type,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS = 'id, pulse_id, user_id, reaction_type, created_at, deleted_at'

// ── Reads ────────────────────────────────────────────────────────────────

export async function listReactionsForPulse(pulseId: string): Promise<Reaction[]> {
  const result = await fromAlive('reactions', SELECT_COLUMNS)
    .eq('pulse_id', pulseId)
    .order('created_at', { ascending: false })
  const rows = unwrap<ReactionRow[]>(result)
  return rows.map(rowToReaction)
}

/**
 * Group reactions by type for rendering counts on a pulse card.
 */
export async function countReactionsByType(
  pulseId: string,
): Promise<Record<ReactionType, number>> {
  const rows = await listReactionsForPulse(pulseId)
  const counts: Record<ReactionType, number> = {
    fire: 0,
    eyes: 0,
    skull: 0,
    lightning: 0,
  }
  for (const r of rows) counts[r.reactionType] += 1
  return counts
}

// ── Writes ───────────────────────────────────────────────────────────────

/**
 * Add a reaction. Idempotent — repeat calls return the existing row.
 */
export async function addReaction(
  pulseId: string,
  reactionType: ReactionType,
): Promise<Reaction> {
  const userId = await requireUserId({ action: 'react to a pulse' })

  const result = await supabase
    .from('reactions')
    .upsert(
      {
        pulse_id: pulseId,
        user_id: userId,
        reaction_type: reactionType,
        deleted_at: null,
      },
      {
        onConflict: 'pulse_id,user_id,reaction_type',
        ignoreDuplicates: false,
      },
    )
    .select(SELECT_COLUMNS)
    .single()

  const row = unwrap<ReactionRow>(result)
  return rowToReaction(row)
}

/**
 * Remove a reaction (soft-delete). Safe if the reaction never existed.
 */
export async function removeReaction(
  pulseId: string,
  reactionType: ReactionType,
): Promise<void> {
  const userId = await requireUserId({ action: 'remove your reaction' })
  const result = await supabase
    .from('reactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('pulse_id', pulseId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType)
    .is('deleted_at', null)
  if (result.error) {
    throw Object.assign(new Error(result.error.message), { cause: result.error })
  }
}

/**
 * Toggle a reaction on/off. Returns the resulting state.
 */
export async function toggleReaction(
  pulseId: string,
  reactionType: ReactionType,
): Promise<'added' | 'removed'> {
  const userId = await requireUserId({ action: 'react to a pulse' })

  const existing = await supabase
    .from('reactions')
    .select('id, deleted_at')
    .eq('pulse_id', pulseId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType)
    .maybeSingle()

  if (existing.data && existing.data.deleted_at === null) {
    await removeReaction(pulseId, reactionType)
    return 'removed'
  }

  await addReaction(pulseId, reactionType)
  return 'added'
}
