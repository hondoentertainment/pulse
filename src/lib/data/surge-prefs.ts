/**
 * Persist surge mute + quiet hours on existing follows / push_tokens rows.
 * A missing column or signed-out user is an honest failure — delivery
 * still no-ops when VAPID keys are absent.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import type { QuietHours } from '@/lib/surge-prefs'

export async function saveVenueSurgeMuted(venueId: string, muted: boolean): Promise<boolean> {
  try {
    const userId = await requireUserId({ action: 'mute venue surge alerts' })
    const { error } = await supabase
      .from('follows')
      .update({ surge_muted: muted })
      .eq('follower_id', userId)
      .eq('target_kind', 'venue')
      .eq('target_venue_id', venueId)
      .is('deleted_at', null)
    return !error
  } catch {
    return false
  }
}

export async function saveQuietHoursOnServer(hours: QuietHours): Promise<boolean> {
  try {
    const userId = await requireUserId({ action: 'save surge quiet hours' })
    const { data, error } = await supabase
      .from('push_tokens')
      .update({
        quiet_hours_start: hours.start,
        quiet_hours_end: hours.end,
      })
      .eq('user_id', userId)
      .eq('platform', 'web')
      .select('id')
    if (error) return false
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}
