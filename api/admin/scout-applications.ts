/**
 * GET  /api/admin/scout-applications — list pending + recent applications
 * POST /api/admin/scout-applications — approve or reject an application
 *
 * POST body: { application_id: string, action: 'approve' | 'reject', tier?: ScoutTier }
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
import { requireAuth, decodeJwt } from '../_lib/auth'
import { asEnum, asString, isPlainObject } from '../_lib/validate'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'

const SCOUT_TIERS = ['rookie', 'regular', 'lead'] as const
const ACTIONS = ['approve', 'reject'] as const

type ScoutTier = (typeof SCOUT_TIERS)[number]
type ReviewAction = (typeof ACTIONS)[number]

interface ReviewBody {
  application_id: string
  action: ReviewAction
  tier?: ScoutTier
}

interface ValidationOk {
  ok: true
  value: ReviewBody
}
interface ValidationErr {
  ok: false
  errors: string[]
}

export function validateReviewBody(body: unknown): ValidationOk | ValidationErr {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] }

  const errors: string[] = []
  const applicationId = asString(body.application_id, 1, 128)
  if (!applicationId) errors.push('application_id is required')

  const action = asEnum(body.action, ACTIONS)
  if (!action) errors.push(`action must be one of: ${ACTIONS.join(', ')}`)

  const value: ReviewBody = {
    application_id: applicationId ?? '',
    action: action ?? 'reject',
  }

  if (body.tier !== undefined && body.tier !== null) {
    const tier = asEnum(body.tier, SCOUT_TIERS)
    if (!tier) errors.push(`tier must be one of: ${SCOUT_TIERS.join(', ')}`)
    else value.tier = tier
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

function requireAdmin(req: RequestLike, res: ResponseLike, token: string): boolean {
  const claims = decodeJwt(token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string })
    | null
  const role =
    (claims?.app_metadata && typeof claims.app_metadata.role === 'string'
      ? claims.app_metadata.role
      : undefined) ?? (typeof claims?.role === 'string' ? claims.role : undefined)
  if (role !== 'admin') {
    fail(res, 403, 'forbidden', 'Admin role required')
    return false
  }
  return true
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }
  if (!requireAdmin(req, res, auth.context.token)) return

  const client = buildSupabaseClient(auth.context.token)

  if (req.method === 'GET') {
    const { data, error } = await client
      .from('scout_applications')
      .select(
        'id, user_id, status, tier, motivation, neighborhoods, reviewed_at, created_at, profiles(username, display_name)',
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      fail(res, 500, 'fetch_failed', 'Failed to load scout applications', {
        details: error.message,
      })
      return
    }
    ok(res, { applications: data ?? [] }, 200)
    return
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['GET', 'POST'])
    return
  }

  const validated = validateReviewBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.errors.join('; '))
    return
  }

  const claims = decodeJwt(auth.context.token) as
    | (Record<string, unknown> & { sub?: string })
    | null
  const reviewerId = typeof claims?.sub === 'string' ? claims.sub : auth.context.userId
  const now = new Date().toISOString()

  const { data: application, error: fetchError } = await client
    .from('scout_applications')
    .select('id, user_id, status')
    .eq('id', validated.value.application_id)
    .single()

  if (fetchError || !application) {
    fail(res, 404, 'not_found', 'Scout application not found')
    return
  }

  if (application.status !== 'pending') {
    fail(res, 409, 'already_reviewed', 'Application has already been reviewed')
    return
  }

  const nextStatus = validated.value.action === 'approve' ? 'approved' : 'rejected'
  const approvedTier = validated.value.tier ?? 'rookie'

  const { error: updateError } = await client
    .from('scout_applications')
    .update({
      status: nextStatus,
      tier: validated.value.action === 'approve' ? approvedTier : 'rookie',
      reviewed_at: now,
      reviewed_by: reviewerId,
    })
    .eq('id', validated.value.application_id)

  if (updateError) {
    fail(res, 500, 'persist_failed', 'Failed to update scout application', {
      details: updateError.message,
    })
    return
  }

  if (validated.value.action === 'approve') {
    const quotaMap = { rookie: 3, regular: 7, lead: 14 } as const
    const { error: profileError } = await client
      .from('profiles')
      .update({
        scout_tier: approvedTier,
        scout_weekly_quota: quotaMap[approvedTier],
        scout_approved_at: now,
      })
      .eq('id', application.user_id)

    if (profileError) {
      fail(res, 500, 'profile_update_failed', 'Approved application but failed to update profile', {
        details: profileError.message,
      })
      return
    }
  }

  ok(
    res,
    {
      application_id: validated.value.application_id,
      status: nextStatus,
      tier: validated.value.action === 'approve' ? approvedTier : null,
    },
    200,
  )
}
