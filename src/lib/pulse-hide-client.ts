/**
 * Owner read of hidden pulses, and admin hide/undo.
 * A missing column (migration not applied yet) stays an empty list.
 */

import { mapOwnerHiddenRow, type OwnerHiddenPulse } from './pulse-hide'

async function sessionToken(): Promise<string | null> {
  try {
    const mod = await import('./supabase')
    if (!mod.hasSupabaseConfig) return null
    const { data } = await mod.supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

export async function loadOwnHiddenPulses(userId: string): Promise<OwnerHiddenPulse[]> {
  if (!userId) return []
  try {
    const mod = await import('./supabase')
    if (!mod.hasSupabaseConfig) return []
    const { data, error } = await mod.supabase
      .from('pulses')
      .select('id, venue_id, caption, energy_rating, created_at, hidden_at, hidden_note')
      .eq('user_id', userId)
      .not('hidden_at', 'is', null)
      .order('hidden_at', { ascending: false })
      .limit(20)
    if (error || !data) return []
    return data.flatMap((row) => {
      const mapped = mapOwnerHiddenRow(row)
      return mapped ? [mapped] : []
    })
  } catch {
    return []
  }
}

export async function persistPulseHide(input: {
  pulseId: string
  note?: string | null
  undo?: boolean
}): Promise<{ ok: boolean; message?: string }> {
  const token = await sessionToken()
  if (!token) return { ok: false, message: 'Sign in as an admin to hide a post' }
  try {
    const response = await fetch('/api/pulses/hide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pulseId: input.pulseId,
        note: input.note ?? null,
        undo: input.undo === true,
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null
      return { ok: false, message: payload?.error?.message ?? 'Could not update this post' }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Could not update this post' }
  }
}
