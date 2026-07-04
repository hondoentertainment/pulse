/**
 * POST /api/pulses/react
 *
 * Authenticated reaction toggle via `toggle_pulse_reaction` RPC.
 * Notifies the pulse author on new reactions (not removals).
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
import { asEnum, asString, isPlainObject } from '../_lib/validate'
import { createUserClient } from '../_lib/supabase-server'
import { notifyPulseAuthorOfReaction } from '../_lib/pulse-reaction-notify'

const REACTION_TYPES = ['fire', 'eyes', 'skull', 'lightning'] as const
type ReactionType = (typeof REACTION_TYPES)[number]

type ReactBody = {
  pulseId: string
  reactionType: ReactionType
}

function validateBody(
  body: Record<string, unknown>,
): { ok: true; value: ReactBody } | { ok: false; error: string } {
  const pulseId = asString(body.pulseId, 1, 128)
  if (!pulseId) return { ok: false, error: 'pulseId must be a non-empty string (max 128)' }

  const reactionType = asEnum(body.reactionType, REACTION_TYPES) as ReactionType | null
  if (!reactionType) {
    return { ok: false, error: `reactionType must be one of: ${REACTION_TYPES.join(', ')}` }
  }

  return { ok: true, value: { pulseId, reactionType } }
}

function userInReaction(
  reactions: Record<string, string[]> | null | undefined,
  type: ReactionType,
  userId: string,
): boolean {
  const list = reactions?.[type]
  return Array.isArray(list) && list.includes(userId)
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
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

  const rl = consume(auth.context.userId, 'pulse_reaction')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many reactions', {
      retryAfterMs: rl.retryAfterMs,
      limit: rl.limit,
    })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const validated = validateBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.error)
    return
  }

  const client = createUserClient(auth.context.token)

  const { data: beforePulse, error: beforeErr } = await client
    .from('pulses')
    .select('reactions')
    .eq('id', validated.value.pulseId)
    .is('deleted_at', null)
    .maybeSingle()

  if (beforeErr) {
    fail(res, 500, 'pulse_lookup_failed', 'Failed to load pulse', { details: beforeErr.message })
    return
  }

  if (!beforePulse) {
    fail(res, 404, 'pulse_not_found', 'Pulse not found')
    return
  }

  const willAdd = !userInReaction(
    beforePulse.reactions as Record<string, string[]> | null,
    validated.value.reactionType,
    auth.context.userId,
  )

  const { data: reactions, error: rpcErr } = await client.rpc('toggle_pulse_reaction', {
    target_pulse_id: validated.value.pulseId,
    target_reaction_type: validated.value.reactionType,
  })

  if (rpcErr) {
    fail(res, 500, 'reaction_failed', 'Failed to toggle reaction', { details: rpcErr.message })
    return
  }

  if (willAdd) {
    void notifyPulseAuthorOfReaction({
      pulseId: validated.value.pulseId,
      reactorUserId: auth.context.userId,
      reactionType: validated.value.reactionType,
    })
  }

  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  ok(res, {
    reactions: reactions ?? beforePulse.reactions,
    added: willAdd,
  })
}
