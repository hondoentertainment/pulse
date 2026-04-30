/**
 * GET /api/ticketing/mine
 *
 * Returns the authenticated caller's tickets. Uses the caller's JWT so RLS
 * enforces `auth.uid() = user_id OR auth.uid() = transferable_to_user_id`
 * rather than re-implementing that check here.
 *
 * Response: { data: TicketRow[] }
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  serverError,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { extractBearer, verifySupabaseJwt } from '../_lib/auth'
import { createUserClient } from '../_lib/supabase-server'

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'OPTIONS'])
  }

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) return unauthorized(res, auth.error ?? 'Unauthorized')
  const token = extractBearer(req)
  if (!token) return unauthorized(res, 'Missing bearer token')

  const supabase = createUserClient(token)

  try {
    const { data, error } = await supabase
      .from('tickets')
      .select(
        'id, event_id, user_id, ticket_type, price_cents, currency, status, stripe_payment_intent, qr_code_secret, created_at, paid_at, refunded_at, transferred_at',
      )
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return serverError(res, error.message ?? 'ticket_list_failed')
    ok(res, data ?? [])
  } catch (err) {
    serverError(res, err instanceof Error ? err.message : 'internal_error')
  }
}
