/**
 * Admin-gated API key generation.
 *
 * POST /api/keys/generate
 *   body: { name: string, ownerId: string, tier?: 'free'|'starter'|'business'|'enterprise' }
 *   headers: Authorization: Bearer <supabase-jwt>
 *
 * Requires the caller to be:
 *   (a) an authenticated Supabase user, AND
 *   (b) listed in SUPABASE_ADMIN_EMAILS (server-side env var).
 *
 * This replaces src/lib/public-api.ts#generateAPIKey being called from
 * the browser, where anyone could mint keys. Cryptographically secure
 * random bytes come from node:crypto here instead of Math.random().
 */

import { randomBytes } from 'crypto'
import {
  badRequest,
  forbidden,
  handleOptions,
  methodNotAllowed,
  readJson,
  serverError,
  setCors,
  tooManyRequests,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { asEnum, asString, isPlainObject } from '../_lib/validate'
import { clientKey, rateLimit } from '../_lib/rate-limit'
import { verifySupabaseJwt } from '../_lib/auth'

type Tier = 'free' | 'starter' | 'business' | 'enterprise'

const TIER_LIMITS: Record<Tier, { rateLimit: number; daily: number }> = {
  free: { rateLimit: 60, daily: 1000 },
  starter: { rateLimit: 300, daily: 10000 },
  business: { rateLimit: 1000, daily: 100000 },
  enterprise: { rateLimit: 5000, daily: 1000000 },
}

interface GenerateRequest {
  name: string
  ownerId: string
  tier: Tier
}

function parseBody(raw: unknown): GenerateRequest | null {
  if (!isPlainObject(raw)) return null
  const name = asString(raw.name, 1, 200)
  const ownerId = asString(raw.ownerId, 1, 200)
  if (!name || !ownerId) return null
  const tier = asEnum(raw.tier ?? 'free', ['free', 'starter', 'business', 'enterprise'] as const)
  if (!tier) return null
  return { name, ownerId, tier }
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex')
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  setCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const rl = rateLimit(clientKey(req, 'key-generate'), 10, 60_000)
  if (!rl.allowed) return tooManyRequests(res, 'Too many key generations', rl.retryAfterSeconds)

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) return unauthorized(res, auth.error ?? 'Unauthorized')
  if (!auth.user.isAdmin) return forbidden(res, 'Admin access required')

  let body: GenerateRequest | null
  try {
    const raw = await readJson(req)
    body = parseBody(raw)
  } catch {
    return badRequest(res, 'Invalid JSON body')
  }
  if (!body) return badRequest(res, 'name, ownerId, and optional tier required')

  try {
    const limits = TIER_LIMITS[body.tier]
    const apiKey = {
      id: `key-${Date.now()}-${randomHex(4)}`,
      key: `pk_${body.tier}_${randomHex(16)}`,
      name: body.name,
      ownerId: body.ownerId,
      tier: body.tier,
      createdAt: new Date().toISOString(),
      active: true,
      rateLimit: limits.rateLimit,
      dailyRequests: 0,
      dailyLimit: limits.daily,
      issuedBy: auth.user.email ?? auth.user.id,
    }
    res.status(201).json({ data: apiKey })
  } catch (err) {
    serverError(
      res,
      'Failed to generate API key',
      err instanceof Error ? err.message : undefined
    )
  }
}
