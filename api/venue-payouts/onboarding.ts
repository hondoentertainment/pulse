/**
 * POST /api/venue-payouts/onboarding
 *
 * Creates or retrieves a Stripe Connect (Express) account for the venue
 * the caller manages, then issues an onboarding AccountLink URL.
 *
 * Caller must be venue staff with role in ('owner', 'admin').
 *
 * Body: { venue_id: uuid, refresh_url: string, return_url: string }
 */

import { authenticate } from '../_lib/auth'
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
import {
  createAccountLink,
  createConnectedAccount,
  retrieveConnectedAccount,
} from '../_lib/stripe'
import { getServiceSupabase } from '../_lib/supabase-server'
import { isString, isUuid, requireFields } from '../_lib/validate'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const auth = await authenticate(req)
  if (!auth) return unauthorized(res)

  const errors = requireFields(req.body, {
    venue_id: isUuid,
    refresh_url: isString,
    return_url: isString,
  })
  if (errors.length) return badRequest(res, 'validation_failed', errors)

  const { venue_id, refresh_url, return_url } = req.body as {
    venue_id: string
    refresh_url: string
    return_url: string
  }

  const supabase = getServiceSupabase()
  if (!supabase) return serverError(res, new Error('Supabase not configured'))

  try {
    // Authorisation: caller must be owner/admin of this venue.
    const { data: staff } = await supabase
      .from('venue_staff')
      .select('role')
      .eq('user_id', auth.userId)
      .eq('venue_id', venue_id)
      .maybeSingle()
    if (!staff || !['owner', 'admin'].includes(staff.role)) return forbidden(res)

    const { data: existing } = await supabase
      .from('venue_payout_accounts')
      .select('stripe_account_id, status, charges_enabled, payouts_enabled, details_submitted')
      .eq('venue_id', venue_id)
      .maybeSingle()

    let accountId = existing?.stripe_account_id ?? null

    if (!accountId) {
      const acct = await createConnectedAccount(auth.email ?? 'owner@example.com')
      accountId = acct.id
      await supabase.from('venue_payout_accounts').upsert({
        venue_id,
        stripe_account_id: accountId,
        status: 'pending',
        charges_enabled: acct.charges_enabled,
        payouts_enabled: acct.payouts_enabled,
        details_submitted: acct.details_submitted,
        updated_at: new Date().toISOString(),
      })
    } else {
      // Refresh state from Stripe in case it changed out-of-band.
      const acct = await retrieveConnectedAccount(accountId)
      await supabase
        .from('venue_payout_accounts')
        .update({
          charges_enabled: acct.charges_enabled,
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq('venue_id', venue_id)
    }

    const link = await createAccountLink(accountId!, refresh_url, return_url)
    res.status(200).json({
      data: {
        stripe_account_id: accountId,
        onboarding_url: link.url,
        expires_at: link.expires_at,
      },
    })
  } catch (err) {
    serverError(res, err)
  }
}
