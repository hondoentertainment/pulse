/**
 * GET  /api/admin/vibe-vision — telemetry summary (admin)
 * POST /api/admin/vibe-vision — batch assess photo URLs (admin / scout QA)
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
import { isPlainObject } from '../_lib/validate'
import { AnthropicError } from '../_lib/anthropic'
import { assessVenueVibe, VIBE_CONFIDENCE_APPLY_THRESHOLD } from '../_lib/vibe-vision'
import { recordAssessEvent } from '../_lib/vibe-assess-cost'

function buildSupabaseClient(userJwt: string): SupabaseClient {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (serviceKey) {
    const { url } = getSupabaseConfig()
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return createUserClient(userJwt)
}

function requireAdmin(
  req: RequestLike,
  res: ResponseLike,
): { userId: string; token: string } | null {
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

async function handleGet(req: RequestLike, res: ResponseLike, token: string): Promise<void> {
  const hours = Math.min(
    168,
    Math.max(1, Number.parseInt(String(req.query?.hours ?? '24'), 10) || 24),
  )
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  try {
    const client = buildSupabaseClient(token)
    const { data: events, error } = await client
      .from('vibe_assess_events')
      .select(
        'id,energy_rating,confidence,safe,blocked_reason,cost_cents,source,created_at,venue_id',
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      // Table may not exist yet — return empty telemetry.
      ok(res, {
        hours,
        total: 0,
        blocked: 0,
        lowConfidence: 0,
        avgConfidence: null,
        totalCostCents: 0,
        byEnergy: {},
        bySource: {},
        recent: [],
        confidenceThreshold: VIBE_CONFIDENCE_APPLY_THRESHOLD,
        note: error.message,
      })
      return
    }

    const rows = events ?? []
    const blocked = rows.filter((r) => r.safe === false).length
    const lowConfidence = rows.filter(
      (r) =>
        r.safe !== false &&
        typeof r.confidence === 'number' &&
        Number(r.confidence) < VIBE_CONFIDENCE_APPLY_THRESHOLD,
    ).length
    const confidences = rows
      .map((r) => Number(r.confidence))
      .filter((n) => Number.isFinite(n))
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : null
    const totalCostCents = rows.reduce((sum, r) => sum + Number(r.cost_cents ?? 0), 0)

    const byEnergy: Record<string, number> = {}
    const bySource: Record<string, number> = {}
    for (const r of rows) {
      const e = String(r.energy_rating ?? 'unknown')
      byEnergy[e] = (byEnergy[e] ?? 0) + 1
      const s = String(r.source ?? 'unknown')
      bySource[s] = (bySource[s] ?? 0) + 1
    }

    ok(res, {
      hours,
      total: rows.length,
      blocked,
      lowConfidence,
      avgConfidence,
      totalCostCents,
      byEnergy,
      bySource,
      recent: rows.slice(0, 25),
      confidenceThreshold: VIBE_CONFIDENCE_APPLY_THRESHOLD,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load vibe vision stats'
    fail(res, 500, 'stats_error', message)
  }
}

async function handlePost(
  req: RequestLike,
  res: ResponseLike,
  admin: { userId: string; token: string },
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    fail(res, 500, 'not_configured', 'ANTHROPIC_API_KEY is not configured')
    return
  }
  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const rawUrls = req.body.imageUrls
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    fail(res, 400, 'invalid_input', 'imageUrls must be a non-empty array')
    return
  }
  const imageUrls = rawUrls
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim())
    .slice(0, 10)

  if (imageUrls.length === 0) {
    fail(res, 400, 'invalid_input', 'No valid imageUrls')
    return
  }

  const results: Array<Record<string, unknown>> = []
  for (const imageUrl of imageUrls) {
    try {
      const outcome = await assessVenueVibe({
        apiKey,
        image: { type: 'url', url: imageUrl },
      })
      await recordAssessEvent({
        userId: admin.userId,
        userJwt: admin.token,
        energyRating: outcome.result.energyRating,
        confidence: outcome.result.confidence,
        safe: outcome.result.safe,
        blockedReason: outcome.result.blockedReason,
        costCents: outcome.costCents,
        source: 'admin_batch',
      })
      results.push({
        imageUrl,
        ok: true,
        ...outcome.result,
        costCents: outcome.costCents,
        applyEnergy: outcome.result.confidence >= VIBE_CONFIDENCE_APPLY_THRESHOLD,
      })
    } catch (err) {
      const message = err instanceof AnthropicError || err instanceof Error ? err.message : String(err)
      results.push({ imageUrl, ok: false, error: message })
    }
  }

  ok(res, {
    count: results.length,
    results,
    confidenceThreshold: VIBE_CONFIDENCE_APPLY_THRESHOLD,
  })
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return

  const admin = requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    await handleGet(req, res, admin.token)
    return
  }
  if (req.method === 'POST') {
    await handlePost(req, res, admin)
    return
  }
  methodNotAllowed(res, ['GET', 'POST', 'OPTIONS'])
}
