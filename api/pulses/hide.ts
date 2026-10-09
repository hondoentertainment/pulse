/**
 * POST /api/pulses/hide — admin hides a pulse and stores the owner-visible note.
 * POST { pulseId, undo: true } reverses a hide inside the undo window.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { requireAuth, decodeJwt } from '../_lib/auth.js'
import { isPlainObject } from '../_lib/validate.js'
import { createAdminClient, createUserClient } from '../_lib/supabase-server.js'
import { hidePulseDecision, undoHideDecision } from '../../src/lib/pulse-hide.js'

function isAdminToken(token: string): boolean {
  const claims = decodeJwt(token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string })
    | null
  const role =
    (claims?.app_metadata && typeof claims.app_metadata.role === 'string'
      ? claims.app_metadata.role
      : undefined) ?? (typeof claims?.role === 'string' ? claims.role : undefined)
  return role === 'admin'
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
  if (!isAdminToken(auth.context.token)) {
    fail(res, 403, 'forbidden', 'Admin role required to hide a post')
    return
  }
  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }
  const pulseId = typeof req.body.pulseId === 'string' ? req.body.pulseId.trim() : ''
  if (!pulseId) {
    fail(res, 400, 'invalid_input', 'pulseId is required')
    return
  }
  const undo = req.body.undo === true
  const client = createUserClient(auth.context.token)
  const { data: existing, error: readError } = await client
    .from('pulses')
    .select('id, user_id, hidden_at')
    .eq('id', pulseId)
    .maybeSingle()
  if (readError) {
    fail(res, 500, 'hide_failed', readError.message)
    return
  }
  if (!existing) {
    fail(res, 404, 'not_found', 'Pulse not found')
    return
  }

  if (undo) {
    const decision = undoHideDecision({
      admin: true,
      hiddenAt: typeof existing.hidden_at === 'string' ? existing.hidden_at : null,
    })
    if (!decision.ok) {
      const message = decision.reason === 'expired'
        ? 'Undo window has closed'
        : 'This post is not hidden'
      fail(res, 400, 'undo_closed', message)
      return
    }
    const { error } = await client
      .from('pulses')
      .update({ hidden_at: null, hidden_note: null, hidden_by: null })
      .eq('id', pulseId)
    if (error) {
      fail(res, 500, 'hide_failed', error.message)
      return
    }
    ok(res, { hidden: false, pulseId })
    return
  }

  const decision = hidePulseDecision({
    admin: true,
    note: typeof req.body.note === 'string' ? req.body.note : null,
  })
  if (!decision.ok) {
    fail(res, 400, 'invalid_input', decision.message)
    return
  }
  const { error } = await client
    .from('pulses')
    .update({
      hidden_at: decision.hiddenAt,
      hidden_note: decision.note,
      hidden_by: auth.context.userId,
    })
    .eq('id', pulseId)
  if (error) {
    fail(res, 500, 'hide_failed', error.message)
    return
  }

  const ownerId = typeof existing.user_id === 'string' ? existing.user_id : null
  const admin = createAdminClient()
  if (ownerId && admin) {
    await admin.from('notifications').insert({
      user_id: ownerId,
      type: 'impact',
      pulse_id: pulseId,
      read: false,
    }).then(({ error: notifyError }) => {
      if (notifyError) console.warn('[hide] owner notify skipped', notifyError.message)
    })
  }

  ok(res, { hidden: true, pulseId, hiddenAt: decision.hiddenAt, note: decision.note })
}
