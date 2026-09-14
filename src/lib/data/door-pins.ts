import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import type { VenueDoorPin } from '@/lib/door-pin'

export async function fetchVenueDoorPin(venueId: string): Promise<VenueDoorPin | null> {
  const { data, error } = await supabase
    .from('venue_door_pins')
    .select('venue_id, pulse_id, pinned_by, pinned_at')
    .eq('venue_id', venueId)
    .maybeSingle()
  if (error || !data) return null
  return {
    venueId: data.venue_id as string,
    pulseId: data.pulse_id as string,
    pinnedBy: data.pinned_by as string,
    pinnedAt: data.pinned_at as string,
  }
}

export async function pinVenueDoorPulse(input: {
  venueId: string
  pulseId: string
}): Promise<VenueDoorPin> {
  const userId = await requireUserId({ action: 'pin from the door' })
  const { error } = await supabase.from('venue_door_pins').upsert({
    venue_id: input.venueId,
    pulse_id: input.pulseId,
    pinned_by: userId,
    pinned_at: new Date().toISOString(),
  }, { onConflict: 'venue_id' })
  if (error) throw Object.assign(new Error(error.message), { cause: error })
  return {
    venueId: input.venueId,
    pulseId: input.pulseId,
    pinnedBy: userId,
    pinnedAt: new Date().toISOString(),
  }
}

export async function listMyPresenceLastNight(userId: string, sinceIso: string): Promise<{
  venueId: string
  userId: string
  checkedInAt: string
  leftAt: string | null
}[]> {
  const { data, error } = await supabase
    .from('presence')
    .select('venue_id, user_id, checked_in_at, left_at')
    .eq('user_id', userId)
    .gte('checked_in_at', sinceIso)
    .limit(100)
  if (error || !data) return []
  return data.map((row) => ({
    venueId: row.venue_id as string,
    userId: row.user_id as string,
    checkedInAt: row.checked_in_at as string,
    leftAt: (row.left_at as string | null) ?? null,
  }))
}
