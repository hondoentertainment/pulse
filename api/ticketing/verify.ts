/**
 * POST /api/ticketing/verify
 *
 * Body: { ticketQr: string }
 * Auth: Bearer <supabase jwt>. Caller must be venue_staff (JWT claim
 *       `app_metadata.role === 'venue_staff'`) OR a member of the
 *       `venue_staff` table for the ticket's venue.
 *
 * Behavior:
 *  1. Parse QR envelope + verify HMAC with `TICKET_HMAC_SECRET`.
 *  2. Load ticket + staff roles.
 *  3. Gate access via `canScan`.
 *  4. Idempotently flip status to `scanned` with `scanned_at = now()`.
 *  5. Rate-limit per IP+user.
 */

import { createClient } from '@supabase/supabase-js'
import { setCors, sendJson, bearerToken, type ApiRequest, type ApiResponse } from '../_lib/http'
import { checkRateLimit } from '../_lib/rate-limit'
import {
  parseTicketQr,
  verifyTicketHmac,
  decideScan,
  canScan,
  type TicketStatus,
} from '../_lib/ticket-verify'

interface TicketRow {
  id: string
  user_id: string
  venue_id: string
  event_id: string
  type: string
  status: TicketStatus
  scanned_at: string | null
}

interface StaffRow {
  venue_id: string
  user_id: string
  role: string
}

function attendeeInitials(userId: string): string {
  return userId.replace(/-/g, '').slice(0, 2).toUpperCase()
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const token = bearerToken(req)
  if (!token) {
    sendJson(res, 401, { error: 'Missing auth' })
    return
  }

  const body = (req.body ?? {}) as { ticketQr?: unknown }
  if (typeof body.ticketQr !== 'string' || !body.ticketQr) {
    sendJson(res, 400, { error: 'ticketQr required' })
    return
  }

  const rl = checkRateLimit(`verify:${token.slice(0, 16)}`, {
    maxTokens: 30,
    refillPerSec: 1,
  })
  if (!rl.allowed) {
    res.setHeader('retry-after', String(Math.ceil(rl.retryAfterMs / 1000)))
    sendJson(res, 429, { error: 'Too many requests' })
    return
  }

  const payload = parseTicketQr(body.ticketQr)
  if (!payload) {
    sendJson(res, 400, { error: 'Invalid QR payload', code: 'invalid_qr' })
    return
  }

  const secret = process.env.TICKET_HMAC_SECRET
  if (!secret) {
    sendJson(res, 500, { error: 'Server misconfigured: TICKET_HMAC_SECRET missing' })
    return
  }
  const hmacOk = await verifyTicketHmac(payload, secret)
  if (!hmacOk) {
    sendJson(res, 403, { error: 'Signature mismatch', code: 'invalid_signature' })
    return
  }

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    sendJson(res, 500, { error: 'Server misconfigured: Supabase envs missing' })
    return
  }
  const svc = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: authData, error: authErr } = await svc.auth.getUser(token)
  if (authErr || !authData?.user) {
    sendJson(res, 401, { error: 'Invalid token' })
    return
  }
  const caller = authData.user
  const callerRole =
    (caller.app_metadata && typeof caller.app_metadata === 'object'
      ? (caller.app_metadata as { role?: string }).role
      : null) ?? null

  const { data: ticketData, error: ticketErr } = await svc
    .from('tickets')
    .select('id, user_id, venue_id, event_id, type, status, scanned_at')
    .eq('id', payload.ticketId)
    .maybeSingle()
  if (ticketErr || !ticketData) {
    sendJson(res, 404, { error: 'Ticket not found' })
    return
  }
  const ticket = ticketData as TicketRow

  const { data: staffData } = await svc
    .from('venue_staff')
    .select('venue_id, user_id, role')
    .eq('user_id', caller.id)
  const staffRows = (staffData ?? []) as StaffRow[]

  if (!canScan({
    callerRole,
    callerUserId: caller.id,
    ticketVenueId: ticket.venue_id,
    staffRows,
  })) {
    sendJson(res, 403, { error: 'Forbidden', code: 'not_staff' })
    return
  }

  const decision = decideScan({
    ticketStatus: ticket.status,
    scannedAt: ticket.scanned_at,
  })

  if (decision.kind === 'invalid') {
    sendJson(res, 409, { error: `Cannot scan: ${decision.reason}`, code: decision.reason })
    return
  }

  if (decision.kind === 'already_scanned') {
    sendJson(res, 200, {
      data: {
        status: 'already_scanned',
        ticketId: ticket.id,
        attendeeInitials: attendeeInitials(ticket.user_id),
        ticketType: ticket.type,
        scannedAt: decision.scannedAt,
      },
    })
    return
  }

  const scanTs = new Date().toISOString()
  const { error: updateErr } = await svc
    .from('tickets')
    .update({
      status: 'scanned' satisfies TicketStatus,
      scanned_at: scanTs,
      scanned_by_user_id: caller.id,
      scanned_venue_id: ticket.venue_id,
    })
    .eq('id', ticket.id)
    .eq('status', 'paid') // optimistic guard against race
  if (updateErr) {
    sendJson(res, 500, { error: 'Could not record scan' })
    return
  }

  sendJson(res, 200, {
    data: {
      status: 'ok',
      ticketId: ticket.id,
      attendeeInitials: attendeeInitials(ticket.user_id),
      ticketType: ticket.type,
      scannedAt: scanTs,
    },
  })
}
