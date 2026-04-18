/**
 * GET /api/ticketing/expire-pending
 *
 * Vercel cron entry-point (every 5 min). Reconciles capacity by expiring
 * `tickets` rows that have been stuck in `pending` for longer than 30 minutes.
 *
 * Steps per row:
 *   1. Cancel the Stripe PaymentIntent (best effort).
 *   2. Flip ticket.status → 'expired'.
 *   3. Re-increment events.ticket_types[*].remaining for that tier.
 *
 * Authentication: Vercel passes `Authorization: Bearer <CRON_SECRET>` or
 * `x-vercel-cron` (we accept both). Absent CRON_SECRET we allow the call
 * through so the dev box can hit it without fuss.
 */

import {
  handlePreflight,
  methodNotAllowed,
  serverError,
  unauthorized,
  type RequestLike,
  type ResponseLike,
  getHeader,
} from '../_lib/http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PENDING_TIMEOUT_MS = 30 * 60 * 1000

function getServiceClient(): SupabaseClient | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function isAuthorized(req: RequestLike): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const auth = getHeader(req, 'authorization')
  if (auth === `Bearer ${expected}`) return true
  if (getHeader(req, 'x-cron-secret') === expected) return true
  if (getHeader(req, 'x-vercel-cron')) return true
  return false
}

async function cancelPaymentIntentStripe(
  intentId: string,
  key: string,
): Promise<{ ok: boolean; status: number }> {
  const body = new URLSearchParams({ cancellation_reason: 'abandoned' })
  try {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intentId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

interface PendingTicket {
  id: string
  event_id: string
  ticket_type: string
  stripe_payment_intent: string | null
}

/**
 * Pure reconciler — takes a supabase client and a time cutoff and does the
 * work. Split out from the handler so unit tests can drive it directly.
 */
export async function reconcilePendingTickets(
  supabase: SupabaseClient,
  opts: {
    cutoffIso: string
    stripeKey?: string
    log?: (msg: string, meta?: Record<string, unknown>) => void
  },
): Promise<{ expired: number; stripeCancelled: number; errors: number }> {
  const log = opts.log ?? ((m, meta) => console.info(`[ticketing/expire] ${m}`, meta ?? {}))

  const { data, error } = await supabase
    .from('tickets')
    .select('id, event_id, ticket_type, stripe_payment_intent')
    .eq('status', 'pending')
    .lt('created_at', opts.cutoffIso)
    .limit(100)

  if (error) {
    log('query-failed', { error: error.message })
    return { expired: 0, stripeCancelled: 0, errors: 1 }
  }

  const rows = (data ?? []) as PendingTicket[]
  let stripeCancelled = 0
  let expired = 0
  let errors = 0

  for (const row of rows) {
    // 1. Best-effort Stripe cancel.
    if (row.stripe_payment_intent && opts.stripeKey) {
      const result = await cancelPaymentIntentStripe(row.stripe_payment_intent, opts.stripeKey)
      if (result.ok) stripeCancelled += 1
      else log('stripe-cancel-noop', { ticketId: row.id, status: result.status })
    }

    // 2. Flip ticket status. Guarded by `eq('status', 'pending')` so we
    //    don't clobber a ticket that races to paid just before we update.
    const { error: updateErr } = await supabase
      .from('tickets')
      .update({ status: 'expired', expired_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')

    if (updateErr) {
      errors += 1
      log('update-failed', { ticketId: row.id, error: updateErr.message })
      continue
    }

    // 3. Release capacity.
    await releaseCapacity(supabase, row.event_id, row.ticket_type, log)
    expired += 1
  }

  return { expired, stripeCancelled, errors }
}

async function releaseCapacity(
  supabase: SupabaseClient,
  eventId: string,
  ticketType: string,
  log: (m: string, meta?: Record<string, unknown>) => void,
): Promise<void> {
  const { data: eventRow, error } = await supabase
    .from('events')
    .select('id, ticket_types')
    .eq('id', eventId)
    .maybeSingle()
  if (error || !eventRow) {
    log('event-fetch-failed', { eventId, error: error?.message })
    return
  }
  const types = (eventRow as { ticket_types?: unknown }).ticket_types
  if (!Array.isArray(types)) return
  type Tier = { type?: string; name?: string; remaining?: number }
  const next = (types as Tier[]).map(t => {
    const tType = t.type ?? t.name
    if (tType !== ticketType) return t
    return { ...t, remaining: (t.remaining ?? 0) + 1 }
  })
  await supabase.from('events').update({ ticket_types: next }).eq('id', eventId)
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  if (!isAuthorized(req)) return unauthorized(res)

  const supabase = getServiceClient()
  if (!supabase) {
    // Dev fallback: return a noop so Vercel's cron doesn't alert.
    res.status(200).json({ data: { ok: true, devFallback: true, expired: 0 } })
    return
  }

  const cutoffIso = new Date(Date.now() - PENDING_TIMEOUT_MS).toISOString()
  const stripeKey = process.env.STRIPE_SECRET_KEY

  try {
    const result = await reconcilePendingTickets(supabase, { cutoffIso, stripeKey })
    res.status(200).json({
      data: {
        ok: true,
        at: new Date().toISOString(),
        cutoff: cutoffIso,
        ...result,
      },
    })
  } catch (err) {
    serverError(res, 'reconciler_failed', err instanceof Error ? err.message : String(err))
  }
}
