export type PilotSignupStatus = 'created' | 'already_registered' | 'failed'

export interface PilotSignupResult {
  status: PilotSignupStatus
  message: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizePilotEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidPilotEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizePilotEmail(email))
}

export function classifyPilotPersistError(error: { code?: string; message?: string } | null): PilotSignupStatus {
  if (!error) return 'created'
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  if (code === '23505' || message.includes('duplicate') || message.includes('unique')) {
    return 'already_registered'
  }
  return 'failed'
}

export async function submitPilotSignup(input: {
  email: string
  source?: string
  userId?: string
  accessToken?: string | null
}): Promise<PilotSignupResult> {
  const email = normalizePilotEmail(input.email)
  if (!isValidPilotEmail(email)) {
    return { status: 'failed', message: 'Enter a valid email address.' }
  }

  const source = input.source ?? 'pro_pilot'
  const payload = {
    email,
    source,
    user_id: input.userId && input.userId !== 'local-user' ? input.userId : null,
  }

  try {
    const response = await fetch('/api/signal/pilot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      const body = (await response.json()) as { data?: { status?: PilotSignupStatus } }
      const status = body.data?.status === 'already_registered' ? 'already_registered' : 'created'
      return {
        status,
        message: status === 'already_registered'
          ? 'You are already on the pilot list.'
          : 'You are on the list. We will email you when the pilot opens.',
      }
    }

    if (response.status === 409) {
      return { status: 'already_registered', message: 'You are already on the pilot list.' }
    }
  } catch {
    // Fall through to direct Supabase when the API is unavailable locally.
  }

  const { hasSupabaseConfig, supabase } = await import('@/lib/supabase')
  if (!hasSupabaseConfig) {
    return { status: 'failed', message: 'Could not save your email. Try again when the app is online.' }
  }

  const { error } = await supabase.from('signal_pilot_signups').upsert(payload, { onConflict: 'email,source' })
  const status = classifyPilotPersistError(error)
  if (status === 'failed') {
    return { status, message: 'Could not save your email. Try again in a moment.' }
  }
  if (status === 'already_registered') {
    return { status, message: 'You are already on the pilot list.' }
  }
  return { status: 'created', message: 'You are on the list. We will email you when the pilot opens.' }
}
