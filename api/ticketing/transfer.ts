/**
 * POST /api/ticketing/transfer
 *
 * Two modes:
 *   - action=initiate: owner sets `transferable_to_user_id` and a `transfer_token`.
 *   - action=accept:   recipient presents `transfer_token`, ownership swaps.
 *
 * Anti-scalping: at most one transfer per ticket (enforced via a previous
 * `transferred_at` check — once set, no further transfers allowed).
 *
 * Body (initiate): { action: 'initiate', ticket_id: uuid, recipient_user_id: uuid }
 * Body (accept):   { action: 'accept',   ticket_id: uuid, transfer_token: string }
 */

import { createClient } from '@supabase/supabase-js'
import { verifySupabaseJwt } from '../_lib/auth'
import {
  badRequest,
  forbidden,
  handlePreflight,
  methodNotAllowed,
  serverError,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)
const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

function randomToken(): string {
  const bytes = new Uint8Array(16)
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) return unauthorized(res, auth.error ?? 'Unauthorized')
  const userId = auth.user.id

  const body = (req.body ?? {}) as { action?: string; ticket_id?: string; recipient_user_id?: string; transfer_token?: string }
  if (!isUuid(body.ticket_id)) return badRequest(res, 'invalid_ticket_id')

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return serverError(res, 'Supabase not configured')
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, user_id, status, transferable_to_user_id, transfer_token, transferred_at')
      .eq('id', body.ticket_id)
      .maybeSingle()
    if (!ticket) {
      res.status(404).json({ error: 'ticket_not_found' })
      return
    }
    if (ticket.status !== 'paid') return badRequest(res, 'ticket_not_transferable')
    if (ticket.transferred_at) return badRequest(res, 'already_transferred')

    if (body.action === 'initiate') {
      if (ticket.user_id !== userId) return forbidden(res)
      if (!isUuid(body.recipient_user_id)) return badRequest(res, 'invalid_recipient')
      if (body.recipient_user_id === userId) return badRequest(res, 'cannot_transfer_to_self')
      const token = randomToken()
      const { error: updErr } = await supabase
        .from('tickets')
        .update({
          transferable_to_user_id: body.recipient_user_id,
          transfer_token: token,
        })
        .eq('id', ticket.id)
      if (updErr) return serverError(res, updErr.message)
      res.status(200).json({ data: { ticket_id: ticket.id, transfer_token: token } })
      return
    }

    if (body.action === 'accept') {
      if (!isString(body.transfer_token)) return badRequest(res, 'missing_token')
      if (ticket.transferable_to_user_id !== userId) return forbidden(res)
      if (ticket.transfer_token !== body.transfer_token) return forbidden(res, 'invalid_token')
      const { error: updErr } = await supabase
        .from('tickets')
        .update({
          user_id: userId,
          status: 'paid',
          transferable_to_user_id: null,
          transfer_token: null,
          transferred_at: new Date().toISOString(),
        })
        .eq('id', ticket.id)
      if (updErr) return serverError(res, updErr.message)
      res.status(200).json({ data: { ticket_id: ticket.id, status: 'paid' } })
      return
    }

    badRequest(res, 'invalid_action')
  } catch (err) {
    serverError(res, err instanceof Error ? err.message : 'Internal error')
  }
}
