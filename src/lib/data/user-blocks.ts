import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import type { UserBlock } from '@/lib/content-moderation'

export async function listMyBlocks(): Promise<UserBlock[]> {
  const userId = await requireUserId({ action: 'view your blocks' })
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_user_id, created_at')
    .eq('blocker_id', userId)
  if (error || !data) return []
  return data.map((row) => ({
    id: `${row.blocker_id}:${row.blocked_user_id}`,
    blockerId: row.blocker_id as string,
    blockedUserId: row.blocked_user_id as string,
    createdAt: row.created_at as string,
  }))
}

export async function blockUser(blockedUserId: string): Promise<void> {
  const userId = await requireUserId({ action: 'block this person' })
  if (userId === blockedUserId) throw new Error('You cannot block yourself')
  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: userId,
    blocked_user_id: blockedUserId,
  })
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}
