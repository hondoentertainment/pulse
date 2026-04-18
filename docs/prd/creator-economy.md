# PRD: Creator Economy (Q3)

## Problem
Pulse needs network effects. Power users already drive discovery through
pulses; we should formalize that into a creator tier with real revenue so
they promote venues *on* the platform instead of leaking attention off it.

## Users & Stories
* **Aspiring creator** signs up (free tier "creator") and generates a 6-char
  referral code. Applies for verification with social links + content
  samples to unlock the verified/elite tiers.
* **Venue** sponsors a creator by issuing a venue-scoped referral code with
  a discount; the creator earns a share on every ticket/cover sold through
  that code.
* **Creator earns** revenue when a referred user buys a ticket within 30
  days of entering their code. Earnings roll up into bi-weekly payouts
  pushed via Stripe Connect.

## Entities
* `creator_profiles` — tier, handle, bio, niche, payout account
* `referral_codes` — creator-owned, optionally venue-scoped
* `referral_attributions` — one row per code-entry event, linked to a ticket
  on purchase
* `creator_payouts` — period roll-ups
* `creator_verification_requests` — admin review queue

## Flows
1. Apply → form submission → row in `creator_verification_requests` (pending).
2. Admin approves → `creator_profiles.tier` flips to `verified` or `elite`.
3. Creator creates a referral code (rate-limited to 5/day).
4. Buyer enters code (onboarding or checkout) → `referral_attributions` row,
   status `pending`.
5. Buyer completes ticket purchase → `attribute-purchase.ts` (internal) links
   the attribution, computes commission, status → `held`.
6. Payout run (admin, bi-weekly) → rolls held attributions into
   `creator_payouts`, executes Stripe transfer, status → `paid`.

## Fee Model
* **Commission**: flat 10% of `price_cents` (default; configurable per venue).
* **Platform fee on payout**: 0% on commissions (already platform revenue).
* **Stripe transfer fee**: absorbed by platform.
* **Tax withholding**: 0% until we gate by 1099-eligibility (see follow-ups).

## Threats & Mitigations
| Threat | Mitigation |
|---|---|
| Self-referral | `isSelfReferral` guard; `referred_user_id = creator_user_id` rejected |
| Bot referrals | Rate-limit code creation; attributions only from authenticated users; code-entry requires a valid session |
| Fake clicks | Only ticket *purchases* (not visits) generate commission |
| Sybil accounts | Verification tier requires reviewed social links; 30-day window limits burst attacks |
| Cluster IPs / velocity | Fraud playbook (`docs/creator-fraud-playbook.md`) — claw-back flips status to `voided` |
| Replay / double-attribution | One pending row per (referred_user, code); purchase link is 1:1 via `attributed_ticket_id` |

## Compliance
* **1099-K / 1099-NEC**: Track `total_earnings_cents`; follow-up ticket to
  issue 1099-NEC when creator crosses $600/yr.
* **Tax withholding**: `creator_payouts.tax_withheld_cents` column exists;
  actual withholding gated behind KYC (follow-up).
* **FTC disclosure**: Creators must disclose paid partnerships. UI badge
  ("Paid partner") surfaced on venue-scoped codes — follow-up to wire
  into pulse cards.
* **KYC**: Stripe Connect onboarding handles identity + tax W-9 collection;
  creators cannot receive payouts without a completed Connect account.

## Non-goals
* Tip jar (already exists in `creator-economy.ts`).
* Brand partnerships (already exists in `brand-partnerships.ts`).
* ML abuse detection (follow-up).
