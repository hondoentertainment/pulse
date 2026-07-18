/**
 * GET  /api/admin/venue-data-reports  (admin-only)
 * PATCH /api/admin/venue-data-reports  (admin-only)
 *
 * Admin queue for the user-submitted catalog quality signals collected by
 * `POST /api/venues/data-report` (see
 * `supabase/migrations/20260712000000_venue_data_quality.sql` for the
 * `venue_data_reports` table + RLS policies).
 *
 * GET:
 *   Query: ?status=pending|reviewed|actioned|dismissed (default: pending)
 *          ?limit=100 (max 500)
 *   Response: { data: { reports: VenueDataReportRow[] } }, newest first.
 *
 * PATCH:
 *   Body: { id: string, status: 'reviewed' | 'actioned' | 'dismissed' }
 *   Marks the report reviewed by the calling admin (`reviewed_at`,
 *   `reviewed_by`) and returns the updated row.
 *
 * Auth: requires an authed Supabase JWT whose `app_metadata.role === 'admin'`
 * (same local-decode gate as `api/admin/venue-metadata.ts`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  parseQueryInt,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth, decodeJwt } from '../_lib/auth'
import { asEnum, asString, isPlainObject } from '../_lib/validate'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'

const REPORT_STATUSES = ['pending', 'reviewed', 'actioned', 'dismissed'] as const
type ReportStatus = (typeof REPORT_STATUSES)[number]

/** Statuses an admin can transition a report *into* via PATCH. `pending` is the initial state only. */
const PATCHABLE_STATUSES = ['reviewed', 'actioned', 'dismissed'] as const

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

const SELECT_COLUMNS =
  'id, venue_id, user_id, reason, note, menu_url, price_range, proposed_fields, status, created_at, reviewed_at, reviewed_by, venues(name, city)'

interface PatchBody {
  id: string
  status: (typeof PATCHABLE_STATUSES)[number]
}

interface ValidationOk {
  ok: true
  value: PatchBody
}
interface ValidationErr {
  ok: false
  errors: string[]
}

export function validatePatchBody(body: unknown): ValidationOk | ValidationErr {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] }

  const errors: string[] = []
  const id = asString(body.id, 1, 128)
  if (!id) errors.push('id is required')

  const status = asEnum(body.status, PATCHABLE_STATUSES)
  if (!status) errors.push(`status must be one of: ${PATCHABLE_STATUSES.join(', ')}`)

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: { id: id ?? '', status: status ?? 'reviewed' } }
}

/** Exported for test injection — mirrors `buildSupabaseClient` in venue-metadata.ts. */
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

function requireAdmin(req: RequestLike, res: ResponseLike): { userId: string; token: string } | null {
  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return null
  }

  const claims = decodeJwt(auth.context.token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string })
    | null
  const role =
    (claims?.app_metadata && typeof claims.app_metadata.role === 'string'
      ? claims.app_metadata.role
      : undefined) ?? (typeof claims?.role === 'string' ? claims.role : undefined)
  if (role !== 'admin') {
    fail(res, 403, 'forbidden', 'Admin role required')
    return null
  }

  return { userId: auth.context.userId, token: auth.context.token }
}

async function handleGet(req: RequestLike, res: ResponseLike, admin: { token: string }): Promise<void> {
  const statusParam = typeof req.query?.status === 'string' ? req.query.status : 'pending'
  const status = asEnum<ReportStatus>(statusParam, REPORT_STATUSES)
  if (!status) {
    fail(res, 400, 'invalid_input', `status must be one of: ${REPORT_STATUSES.join(', ')}`)
    return
  }

  const limit = parseQueryInt(req.query?.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)

  try {
    const client = buildSupabaseClient(admin.token)
    const { data, error } = await client
      .from('venue_data_reports')
      .select(SELECT_COLUMNS)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      fail(res, 500, 'fetch_failed', 'Failed to fetch venue data reports', { details: error.message })
      return
    }

    ok(res, { reports: data ?? [] }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'fetch_exception', 'Supabase query threw', { details: message })
  }
}

async function handlePatch(
  req: RequestLike,
  res: ResponseLike,
  admin: { userId: string; token: string },
): Promise<void> {
  const validated = validatePatchBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.errors.join('; '))
    return
  }

  try {
    const client = buildSupabaseClient(admin.token)
    const { data, error } = await client
      .from('venue_data_reports')
      .update({
        status: validated.value.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.userId,
      })
      .eq('id', validated.value.id)
      .select(SELECT_COLUMNS)
      .single()

    if (error) {
      fail(res, 500, 'persist_failed', 'Failed to update venue data report', {
        details: error.message,
      })
      return
    }
    if (!data) {
      fail(res, 404, 'not_found', 'Venue data report not found')
      return
    }

    ok(res, data, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'persist_exception', 'Supabase update threw', { details: message })
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    methodNotAllowed(res, ['GET', 'PATCH'])
    return
  }

  const admin = requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    await handleGet(req, res, admin)
  } else {
    await handlePatch(req, res, admin)
  }
}
