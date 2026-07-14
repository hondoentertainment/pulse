/**
 * POST /api/scouts/apply
 *
 * Body: { motivation?: string, neighborhoods?: string[] }
 *
 * Authenticated users submit a scout program application. One pending application
 * per user; admins review via `/api/admin/scout-applications`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { asString, isPlainObject } from '../_lib/validate'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'

const MOTIVATION_MAX = 500
const MAX_NEIGHBORHOODS = 8
const NEIGHBORHOOD_MAX_LEN = 80

interface ScoutApplyBody {
  motivation?: string
  neighborhoods?: string[]
}

interface ValidationOk {
  ok: true
  value: ScoutApplyBody
}
interface ValidationErr {
  ok: false
  errors: string[]
}

export function validateBody(body: unknown): ValidationOk | ValidationErr {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] }

  const errors: string[] = []
  const value: ScoutApplyBody = {}

  if (body.motivation !== undefined && body.motivation !== null) {
    const motivation = asString(body.motivation, 0, MOTIVATION_MAX)
    if (motivation === null) {
      errors.push(`motivation must be a string up to ${MOTIVATION_MAX} characters`)
    } else {
      value.motivation = motivation.trim() === '' ? undefined : motivation.trim()
    }
  }

  if (body.neighborhoods !== undefined) {
    if (!Array.isArray(body.neighborhoods)) {
      errors.push('neighborhoods must be an array')
    } else if (body.neighborhoods.length > MAX_NEIGHBORHOODS) {
      errors.push(`neighborhoods may contain at most ${MAX_NEIGHBORHOODS} entries`)
    } else {
      const neighborhoods: string[] = []
      for (const entry of body.neighborhoods) {
        const n = asString(entry, 1, NEIGHBORHOOD_MAX_LEN)
        if (!n) {
          errors.push('each neighborhood must be a non-empty string')
          break
        }
        neighborhoods.push(n.trim())
      }
      value.neighborhoods = neighborhoods
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value }
}

export function buildSupabaseClient(userJwt: string): SupabaseClient {
  const serviceKey =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY as string | undefined) ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).process?.env?.SUPABASE_SERVICE_KEY as string | undefined)
  if (serviceKey) {
    const { url } = getSupabaseConfig()
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return createUserClient(userJwt)
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const validated = validateBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.errors.join('; '))
    return
  }

  const userId = auth.context.userId

  try {
    const client = buildSupabaseClient(auth.context.token)

    const { data: profile } = await client
      .from('profiles')
      .select('scout_tier')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.scout_tier) {
      fail(res, 409, 'already_scout', 'You are already an approved scout')
      return
    }

    const { data: pending } = await client
      .from('scout_applications')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) {
      fail(res, 409, 'pending_application', 'You already have a pending scout application')
      return
    }

    const { data, error } = await client
      .from('scout_applications')
      .insert({
        user_id: userId,
        motivation: validated.value.motivation ?? null,
        neighborhoods: validated.value.neighborhoods ?? [],
      })
      .select('id, status, created_at')
      .single()

    if (error) {
      fail(res, 500, 'persist_failed', 'Failed to submit scout application', {
        details: error.message,
      })
      return
    }

    ok(res, data, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'persist_exception', 'Scout apply threw', { details: message })
  }
}
