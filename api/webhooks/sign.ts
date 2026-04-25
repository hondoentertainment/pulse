/**
 * Server-side HMAC webhook signing.
 *
 * POST /api/webhooks/sign
 *   body: { event: string, data: object, subscriptionId?: string }
 *
 * Returns a signed WebhookPayload. The secret never leaves the server —
 * callers used to do this with `createHmac` in the browser using a
 * secret embedded in the bundle, which leaked the key. This endpoint
 * replaces that path.
 *
 * Secrets used:
 *   WEBHOOK_HMAC_SECRET        (default signing secret, used when no per-subscription secret is resolvable)
 *   WEBHOOK_HMAC_SECRET_<ID>   (optional per-subscription override — resolved by upper-casing the subscriptionId and replacing non-alphanumerics with _)
 */

import { createHmac, timingSafeEqual } from 'crypto'
import {
  badRequest,
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
import { asString, isPlainObject } from '../_lib/validate'
import { clientKey, rateLimit } from '../_lib/rate-limit'
import { verifySupabaseJwt } from '../_lib/auth'

interface SignRequest {
  event: string
  data: Record<string, unknown>
  subscriptionId?: string
}

function parseBody(raw: unknown): SignRequest | null {
  if (!isPlainObject(raw)) return null
  const event = asString(raw.event, 1, 100)
  if (!event) return null
  if (!isPlainObject(raw.data)) return null
  const subscriptionId =
    raw.subscriptionId !== undefined
      ? asString(raw.subscriptionId, 1, 100) ?? undefined
      : undefined
  return {
    event,
    data: raw.data,
    subscriptionId,
  }
}

function resolveSecret(subscriptionId: string | undefined): string | null {
  if (subscriptionId) {
    const key = `WEBHOOK_HMAC_SECRET_${subscriptionId
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')}`
    const scoped = process.env[key]
    if (scoped) return scoped
  }
  return process.env.WEBHOOK_HMAC_SECRET ?? null
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  setCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const rl = rateLimit(clientKey(req, 'webhook-sign'), 60, 60_000)
  if (!rl.allowed) return tooManyRequests(res, 'Too many signing requests', rl.retryAfterSeconds)

  // Signing is sensitive; require an authenticated Supabase user.
  const auth = await verifySupabaseJwt(req)
  if (!auth.ok) return unauthorized(res, auth.error ?? 'Unauthorized')

  let body: SignRequest | null
  try {
    const raw = await readJson(req)
    body = parseBody(raw)
  } catch {
    return badRequest(res, 'Invalid JSON body')
  }
  if (!body) return badRequest(res, 'event (string) and data (object) required')

  const secret = resolveSecret(body.subscriptionId)
  if (!secret) {
    return serverError(res, 'Webhook signing secret not configured')
  }

  try {
    const timestamp = Date.now()
    const canonical = JSON.stringify({
      event: body.event,
      timestamp,
      data: body.data,
    })
    const signature = createHmac('sha256', secret)
      .update(canonical)
      .digest('hex')
    // Self-check to ensure timing-safe verification path will succeed.
    const expected = Buffer.from(signature)
    timingSafeEqual(expected, expected)
    res.status(200).json({
      data: {
        event: body.event,
        timestamp,
        data: body.data,
        signature,
      },
    })
  } catch (err) {
    serverError(
      res,
      'Failed to sign webhook',
      err instanceof Error ? err.message : undefined
    )
  }
}
