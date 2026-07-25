/**
 * Pulse Pro pilot waitlist capture.
 *
 * The Settings CTA used to fire an analytics event and a toast, storing
 * nothing — so willingness-to-pay was unmeasurable and nobody could actually
 * be contacted when the pilot opened. Signups now land in
 * `signal_pilot_signups` (see migration 20260725000001).
 */
import { hasSupabaseConfig, supabase } from '@/lib/supabase'

export type PilotSignupResult =
  | { status: 'saved' }
  | { status: 'already_registered' }
  | { status: 'unconfigured' }
  | { status: 'invalid_email' }
  | { status: 'error'; message: string }

/**
 * Pragmatic email check — mirrors the CHECK constraint on the table rather
 * than trying to fully validate RFC 5322.
 */
export function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())
}

/**
 * Register interest in the Pro pilot. Idempotent per (email, source): a repeat
 * submission reports `already_registered` rather than erroring.
 */
export async function submitPilotSignup(options: {
  email: string
  userId?: string | null
  source?: string
  note?: string
}): Promise<PilotSignupResult> {
  const email = options.email.trim().toLowerCase()
  if (!isValidEmail(email)) return { status: 'invalid_email' }
  if (!hasSupabaseConfig) return { status: 'unconfigured' }

  const { error } = await supabase.from('signal_pilot_signups').insert({
    email,
    user_id: options.userId ?? null,
    source: options.source ?? 'pro_pilot',
    note: options.note ?? null,
  })

  if (error) {
    // 23505 = unique_violation on (email, source): already on the list.
    if (error.code === '23505') return { status: 'already_registered' }
    return { status: 'error', message: error.message || 'Could not save your signup' }
  }

  return { status: 'saved' }
}
