/**
 * POST /api/moderation/check
 *
 * Authenticated content-moderation endpoint. Returns whether a piece of
 * user-generated content may be submitted, plus the reasons and a severity.
 *
 * Client code calls this via `src/lib/moderation-client.ts` before sending
 * the real write request. The write endpoints themselves (e.g.
 * `api/pulses/create.ts`) call `checkContent` directly so a malicious client
 * cannot skip this gate by omitting the pre-check.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { consume } from '../_lib/rate-limit'
import {
  asString,
  asEnum,
  combine,
  isPlainObject,
} from '../_lib/validate'
import { checkContent, type ContentKind } from '../_lib/moderation'

const CONTENT_KINDS: readonly ContentKind[] = [
  'pulse',
  'comment',
  'profile_bio',
  'venue_description',
]

export default function handler(req: RequestLike, res: ResponseLike): void {
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

  const rl = consume(auth.context.userId, 'moderation_check')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many moderation checks', {
      retryAfterMs: rl.retryAfterMs,
      limit: rl.limit,
    })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const validated = combine({
    content: asString(req.body.content, 'content', {
      maxLength: 4000,
      minLength: 0,
    }),
    kind: asEnum(req.body.kind, 'kind', CONTENT_KINDS),
  })
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.errors.join('; '), {
      errors: validated.errors,
    })
    return
  }

  const result = checkContent({
    content: validated.value.content,
    kind: validated.value.kind,
  })

  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  ok(res, result, 200)
}
