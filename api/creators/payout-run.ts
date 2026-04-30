/**
 * POST /api/creators/payout-run  (admin-only)
 *
 * Rolls all 'held' attributions into creator_payouts rows (one per creator),
 * optionally triggers a Stripe Connect transfer, and flips the attributions
 * to 'paid'.
 *
 * Query params:
 *   ?dry_run=1  — preview, no DB writes, no Stripe calls.
 *
 * Body (optional):
 *   { period_start?: string, period_end?: string }
 *
 * The actual Stripe Connect transfer is delegated to api/_lib/stripe.ts
 * (shared with venue payouts).  If that helper is unavailable at runtime we
 * leave `stripe_transfer_id=null` and the row at status='pending' so ops
 * can retry.
 */
import {
  RequestLike,
  ResponseLike,
  setCors,
  requireAdmin,
  jsonError,
} from './_shared'
import { getStore, CreatorPayoutRow } from './_store'

const MIN_PAYOUT_CENTS = 2500 // $25

type MaybeStripe = {
  createConnectTransfer?: (args: {
    amountCents: number
    destinationAccountId: string
    metadata?: Record<string, string>
  }) => Promise<{ id: string }>
}

async function loadStripeHelper(): Promise<MaybeStripe> {
  try {
    // Dynamic import so tests / environments without the helper still work.
    const mod = (await import('../_lib/stripe')) as MaybeStripe
    return mod
  } catch {
    return {}
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed')

  const admin = requireAdmin(req, res)
  if (!admin) return

  const dryRun =
    req.query?.dry_run === '1' || req.query?.dry_run === 'true'

  const store = getStore()
  const heldByCreator = new Map<string, typeof store.attributions extends Map<string, infer V> ? V[] : never>()

  for (const attr of store.attributions.values()) {
    if (attr.status !== 'held') continue
    const code = store.codes.get(attr.code)
    if (!code) continue
    const arr = heldByCreator.get(code.creator_user_id) ?? []
    arr.push(attr)
    heldByCreator.set(code.creator_user_id, arr)
  }

  const periodStart =
    (req.body && typeof (req.body as { period_start?: string }).period_start === 'string'
      ? (req.body as { period_start: string }).period_start
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
  const periodEnd =
    (req.body && typeof (req.body as { period_end?: string }).period_end === 'string'
      ? (req.body as { period_end: string }).period_end
      : new Date().toISOString())

  const stripe = dryRun ? {} : await loadStripeHelper()
  const payouts: CreatorPayoutRow[] = []

  for (const [creatorUserId, attrs] of heldByCreator.entries()) {
    const gross = attrs.reduce((s, a) => s + a.commission_cents, 0)
    if (gross < MIN_PAYOUT_CENTS) continue

    const platformFee = 0
    const taxWithheld = 0
    const net = gross - platformFee - taxWithheld

    const payout: CreatorPayoutRow = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      creator_user_id: creatorUserId,
      period_start: periodStart,
      period_end: periodEnd,
      gross_cents: gross,
      platform_fee_cents: platformFee,
      tax_withheld_cents: taxWithheld,
      net_cents: net,
      stripe_transfer_id: null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    if (!dryRun) {
      const profile = store.profiles.get(creatorUserId)
      if (profile?.payout_account_id && stripe.createConnectTransfer) {
        try {
          const transfer = await stripe.createConnectTransfer({
            amountCents: net,
            destinationAccountId: profile.payout_account_id,
            metadata: { creator_user_id: creatorUserId, payout_id: payout.id },
          })
          payout.stripe_transfer_id = transfer.id
          payout.status = 'paid'
          for (const a of attrs) {
            a.status = 'paid'
            a.resolved_at = new Date().toISOString()
            store.attributions.set(a.id, a)
          }
        } catch {
          payout.status = 'failed'
        }
      }
      store.payouts.set(payout.id, payout)
    }
    payouts.push(payout)
  }

  res.status(200).json({ data: { dry_run: dryRun, payouts } })
}
