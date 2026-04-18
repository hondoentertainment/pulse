/**
 * Referral attribution helpers.
 *
 * The commission formula and window are centralized here so every callsite
 * (Edge Function, webhook, tests) agrees on the math.  See
 * docs/creator-economy.md for the broader fraud model.
 */

/**
 * Default commission rate on the ticket/cover gross, expressed as a fraction.
 * Override per-venue via a configuration table in future; for now a flat 10%.
 */
export const DEFAULT_COMMISSION_RATE = 0.10

/**
 * Window (ms) during which a pending referral attribution remains eligible
 * to be linked to a ticket purchase.  30 days.
 */
export const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Compute commission_cents from a ticket price.
 *
 *   commission = round(price_cents * rate)
 *
 * Rounding uses banker's rounding-free simple round-half-to-nearest-even
 * avoidance: Math.round.  The platform never forwards a negative commission
 * (defensive clamp at 0).
 */
export function computeCommissionCents(
  priceCents: number,
  rate: number = DEFAULT_COMMISSION_RATE
): number {
  if (!Number.isFinite(priceCents) || priceCents <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  const rounded = Math.round(priceCents * rate)
  return Math.max(0, rounded)
}

/**
 * Is a pending attribution row still inside the 30-day window?
 */
export function isWithinAttributionWindow(
  createdAtIso: string,
  now: number = Date.now(),
  windowMs: number = ATTRIBUTION_WINDOW_MS
): boolean {
  const createdMs = new Date(createdAtIso).getTime()
  if (Number.isNaN(createdMs)) return false
  return now - createdMs <= windowMs && now - createdMs >= 0
}

/**
 * Choose the most recent pending attribution to link to a purchase.
 * We only ever link ONE pending row per purchase; the most recent one wins
 * (this matches the "last touch" attribution model).  Returns null if none.
 */
export interface PendingAttribution {
  id: string
  code: string
  referred_user_id: string
  created_at: string
  status: string
}

export function pickMostRecentPending(
  attributions: PendingAttribution[],
  now: number = Date.now()
): PendingAttribution | null {
  const eligible = attributions
    .filter((a) => a.status === 'pending' && isWithinAttributionWindow(a.created_at, now))
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  return eligible[0] ?? null
}

/**
 * Fraud-prevention guard: detect self-referral.  A creator's own purchases
 * never count toward their earnings.
 */
export function isSelfReferral(
  creatorUserId: string,
  referredUserId: string
): boolean {
  return creatorUserId === referredUserId
}
