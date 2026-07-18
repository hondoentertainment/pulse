/**
 * GET /api/admin/fresh-coverage  (admin-only)
 *
 * Expansion-gate metric: share of venues with report evidence &lt; 90 minutes.
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
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'
import {
  computeFreshCoverageFromRows,
  FRESH_COVERAGE_MAX_MINUTES,
} from '../_lib/fresh-coverage'

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

function requireAdmin(req: RequestLike, res: ResponseLike): string | null {
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
  return auth.context.token
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const token = requireAdmin(req, res)
  if (!token) return

  const city = typeof req.query?.city === 'string' ? req.query.city : 'Seattle'

  try {
    const client = buildSupabaseClient(token)
    const since = new Date(Date.now() - FRESH_COVERAGE_MAX_MINUTES * 60 * 1000).toISOString()

    let venueQuery = client
      .from('venues')
      .select('id, name, neighborhood, city, last_pulse_at')
      .is('deleted_at', null)
      .limit(500)

    if (city) {
      venueQuery = venueQuery.ilike('city', city)
    }

    const [{ data: venues, error: venueError }, { data: pulses, error: pulseError }] =
      await Promise.all([
        venueQuery,
        client
          .from('pulses')
          .select('venue_id, created_at')
          .gte('created_at', since)
          .limit(5000),
      ])

    if (venueError) {
      fail(res, 500, 'fetch_failed', 'Failed to fetch venues', { details: venueError.message })
      return
    }
    if (pulseError) {
      fail(res, 500, 'fetch_failed', 'Failed to fetch pulses', { details: pulseError.message })
      return
    }

    const summary = computeFreshCoverageFromRows(
      venues ?? [],
      (pulses ?? []) as { venue_id: string; created_at: string }[],
    )

    ok(res, { summary, city }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'fetch_exception', 'Fresh coverage query threw', { details: message })
  }
}
