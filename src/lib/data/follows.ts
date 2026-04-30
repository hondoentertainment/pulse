/**
 * Follow relationships: user -> user and user -> venue.
 *
 * A single `follows` row is keyed by (follower_id, target_kind, target_*)
 * with partial unique indexes keeping live edges distinct. We soft-delete
 * on unfollow so we can reason about follow history for recommendations.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { fromAlive, unwrap } from '@/lib/auth/rls-helpers'

export type FollowTargetKind = 'user' | 'venue'

export interface Follow {
  id: string
  followerId: string
  targetKind: FollowTargetKind
  targetUserId: string | null
  targetVenueId: string | null
  createdAt: string
}

interface FollowRow {
  id: string
  follower_id: string
  target_kind: FollowTargetKind
  target_user_id: string | null
  target_venue_id: string | null
  created_at: string
  deleted_at: string | null
}

function rowToFollow(row: FollowRow): Follow {
  return {
    id: row.id,
    followerId: row.follower_id,
    targetKind: row.target_kind,
    targetUserId: row.target_user_id,
    targetVenueId: row.target_venue_id,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS =
  'id, follower_id, target_kind, target_user_id, target_venue_id, created_at, deleted_at'

// ── Reads ────────────────────────────────────────────────────────────────

export async function listFollowedUsers(followerId: string): Promise<string[]> {
  const result = await fromAlive('follows', 'target_user_id')
    .eq('follower_id', followerId)
    .eq('target_kind', 'user')
  const rows = unwrap<{ target_user_id: string }[]>(result)
  return rows.map((r) => r.target_user_id).filter(Boolean)
}

export async function listFollowedVenues(followerId: string): Promise<string[]> {
  const result = await fromAlive('follows', 'target_venue_id')
    .eq('follower_id', followerId)
    .eq('target_kind', 'venue')
  const rows = unwrap<{ target_venue_id: string }[]>(result)
  return rows.map((r) => r.target_venue_id).filter(Boolean)
}

export async function listFollowersOfUser(userId: string): Promise<string[]> {
  const result = await fromAlive('follows', 'follower_id')
    .eq('target_user_id', userId)
    .eq('target_kind', 'user')
  const rows = unwrap<{ follower_id: string }[]>(result)
  return rows.map((r) => r.follower_id)
}

export async function listFollowersOfVenue(venueId: string): Promise<string[]> {
  const result = await fromAlive('follows', 'follower_id')
    .eq('target_venue_id', venueId)
    .eq('target_kind', 'venue')
  const rows = unwrap<{ follower_id: string }[]>(result)
  return rows.map((r) => r.follower_id)
}

// ── Writes ───────────────────────────────────────────────────────────────

export async function followUser(targetUserId: string): Promise<Follow> {
  const followerId = await requireUserId({ action: 'follow this user' })
  if (followerId === targetUserId) {
    throw new Error('You cannot follow yourself.')
  }
  const result = await supabase
    .from('follows')
    .upsert(
      {
        follower_id: followerId,
        target_kind: 'user',
        target_user_id: targetUserId,
        target_venue_id: null,
        deleted_at: null,
      },
      { onConflict: 'follower_id,target_user_id' },
    )
    .select(SELECT_COLUMNS)
    .single()
  return rowToFollow(unwrap<FollowRow>(result))
}

export async function unfollowUser(targetUserId: string): Promise<void> {
  const followerId = await requireUserId({ action: 'unfollow' })
  const result = await supabase
    .from('follows')
    .update({ deleted_at: new Date().toISOString() })
    .eq('follower_id', followerId)
    .eq('target_kind', 'user')
    .eq('target_user_id', targetUserId)
    .is('deleted_at', null)
  if (result.error) {
    throw Object.assign(new Error(result.error.message), { cause: result.error })
  }
}

export async function followVenue(venueId: string): Promise<Follow> {
  const followerId = await requireUserId({ action: 'follow this venue' })
  const result = await supabase
    .from('follows')
    .upsert(
      {
        follower_id: followerId,
        target_kind: 'venue',
        target_user_id: null,
        target_venue_id: venueId,
        deleted_at: null,
      },
      { onConflict: 'follower_id,target_venue_id' },
    )
    .select(SELECT_COLUMNS)
    .single()
  return rowToFollow(unwrap<FollowRow>(result))
}

export async function unfollowVenue(venueId: string): Promise<void> {
  const followerId = await requireUserId({ action: 'unfollow' })
  const result = await supabase
    .from('follows')
    .update({ deleted_at: new Date().toISOString() })
    .eq('follower_id', followerId)
    .eq('target_kind', 'venue')
    .eq('target_venue_id', venueId)
    .is('deleted_at', null)
  if (result.error) {
    throw Object.assign(new Error(result.error.message), { cause: result.error })
  }
}
