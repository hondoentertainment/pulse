import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import type { PulseAgree } from '@/lib/pulse-same'

export async function listAgreesForPulses(pulseIds: readonly string[]): Promise<PulseAgree[]> {
  if (pulseIds.length === 0) return []
  const { data, error } = await supabase
    .from('pulse_agrees')
    .select('pulse_id, user_id, created_at')
    .in('pulse_id', [...pulseIds])
  if (error || !data) return []
  return data.map((row) => ({
    pulseId: row.pulse_id as string,
    userId: row.user_id as string,
    createdAt: row.created_at as string,
  }))
}

export async function fetchAgreeCount(pulseId: string): Promise<number> {
  const { data, error } = await supabase.rpc('pulse_agree_count', { p_pulse_id: pulseId })
  if (error) return 0
  const n = typeof data === 'number' ? data : Number(data)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

export async function togglePulseAgree(pulseId: string): Promise<'added' | 'removed'> {
  const userId = await requireUserId({ action: 'agree with this pulse' })
  const { data: existing } = await supabase
    .from('pulse_agrees')
    .select('pulse_id')
    .eq('pulse_id', pulseId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('pulse_agrees')
      .delete()
      .eq('pulse_id', pulseId)
      .eq('user_id', userId)
    if (error) throw Object.assign(new Error(error.message), { cause: error })
    return 'removed'
  }
  const { error } = await supabase.from('pulse_agrees').insert({
    pulse_id: pulseId,
    user_id: userId,
  })
  if (error) throw Object.assign(new Error(error.message), { cause: error })
  return 'added'
}
