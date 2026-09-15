import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { canSaveCrewTonight, sanitizeCrewMemberIds, type CrewTonightPick } from '@/lib/crew-tonight'

export async function saveCrewTonight(input: {
  venueId: string
  memberUserIds: string[]
  followedUserIds: string[]
}): Promise<CrewTonightPick> {
  const userId = await requireUserId({ action: 'pick a crew' })
  const members = sanitizeCrewMemberIds(input.followedUserIds, input.memberUserIds, userId)
  if (!canSaveCrewTonight(members)) {
    throw new Error('Pick 2–4 people you already follow')
  }
  const { error } = await supabase.from('crew_tonight').upsert({
    owner_id: userId,
    venue_id: input.venueId,
    member_user_ids: members,
  }, { onConflict: 'owner_id,venue_id,night_date' })
  if (error) throw Object.assign(new Error(error.message), { cause: error })
  return { ownerId: userId, venueId: input.venueId, memberUserIds: members }
}
