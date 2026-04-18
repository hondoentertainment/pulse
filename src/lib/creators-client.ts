/**
 * Typed fetch wrappers around the /api/creators/* Edge Functions.
 *
 * All calls assume a Supabase session is already present; the access token
 * is attached as a Bearer.
 */
import { supabase } from '@/lib/supabase'
import type {
  CreatorProfile,
  ReferralCode,
  ReferralAttribution,
} from '@/lib/data/creators'

export interface CreatorMeResponse {
  profile: CreatorProfile | null
  stats: {
    lifetime_earnings_cents: number
    held_cents: number
    paid_cents: number
    pending_attributions: number
    total_attributions: number
    active_codes: number
  }
}

export interface ApplyBody {
  handle: string
  bio?: string
  niche?: string
  social_links: string[]
  content_samples: string[]
}

export interface CreateCodeBody {
  venue_id?: string | null
  discount_cents?: number | null
  valid_to?: string | null
  max_uses?: number | null
}

async function authedFetch<T>(
  path: string,
  init: RequestInit & { expected?: number } = {}
): Promise<T> {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, { ...init, headers })
  const expected = init.expected ?? 200
  if (!res.ok && res.status !== expected) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) msg = body.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  const json = (await res.json()) as { data: T }
  return json.data
}

export async function applyForCreator(body: ApplyBody) {
  return authedFetch<unknown>('/api/creators/apply', {
    method: 'POST',
    body: JSON.stringify(body),
    expected: 201,
  })
}

export async function getCreatorMe(): Promise<CreatorMeResponse> {
  return authedFetch<CreatorMeResponse>('/api/creators/me', {
    method: 'GET',
  })
}

export async function createReferralCode(
  body: CreateCodeBody = {}
): Promise<ReferralCode> {
  return authedFetch<ReferralCode>('/api/creators/referral-codes', {
    method: 'POST',
    body: JSON.stringify(body),
    expected: 201,
  })
}

export async function listReferralCodes(): Promise<ReferralCode[]> {
  return authedFetch<ReferralCode[]>('/api/creators/referral-codes', {
    method: 'GET',
  })
}

export async function deactivateReferralCode(
  code: string
): Promise<ReferralCode> {
  return authedFetch<ReferralCode>(
    `/api/creators/referral-codes?code=${encodeURIComponent(code)}`,
    { method: 'DELETE' }
  )
}

export async function applyReferralCode(
  code: string
): Promise<ReferralAttribution> {
  return authedFetch<ReferralAttribution>('/api/creators/apply-referral', {
    method: 'POST',
    body: JSON.stringify({ code }),
    expected: 201,
  })
}
