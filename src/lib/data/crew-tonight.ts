import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { canSaveCrewTonight, sanitizeCrewMemberIds, type CrewTonightPick } from '@/lib/crew-tonight'
import { crewImHereForViewer, type CrewPresenceRow, type CrewTonightMembership } from '@/lib/crew-im-here'

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

/** Crew mates here at the pinned venue. Guests and other crews get nothing. */
export async function listCrewImHere(venueId: string): Promise<CrewPresenceRow[]> {
  let viewerId = ''
  try {
    viewerId = await requireUserId({ action: 'see your crew' })
  } catch {
    return []
  }
  const { data: crews, error } = await supabase
    .from('crew_tonight')
    .select('owner_id, venue_id, member_user_ids')
    .eq('venue_id', venueId)
  if (error || !crews) return []
  const memberships: CrewTonightMembership[] = crews.map((row) => ({
    ownerId: String(row.owner_id),
    venueId: String(row.venue_id),
    memberUserIds: Array.isArray(row.member_user_ids) ? row.member_user_ids.map(String) : [],
  }))
  const mateIds = new Set<string>()
  for (const crew of memberships) {
    if (crew.ownerId === viewerId || crew.memberUserIds.includes(viewerId)) {
      mateIds.add(crew.ownerId)
      crew.memberUserIds.forEach((id) => mateIds.add(id))
    }
  }
  mateIds.delete(viewerId)
  if (mateIds.size === 0) return []
  const { data: presence } = await supabase
    .from('presence')
    .select('user_id, venue_id, checked_in_at, left_at')
    .eq('venue_id', venueId)
    .in('user_id', [...mateIds])
    .is('left_at', null)
  const rows: CrewPresenceRow[] = (presence ?? []).map((row) => ({
    userId: String(row.user_id),
    venueId: String(row.venue_id),
    checkedInAt: String(row.checked_in_at),
    leftAt: row.left_at ? String(row.left_at) : null,
  }))
  return crewImHereForViewer({
    viewerId,
    crews: memberships,
    presence: rows,
    venueId,
  })
}
