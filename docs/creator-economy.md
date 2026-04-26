# Creator Economy — Architecture & Operations

## Architecture

```
Client (React PWA)
  └── /onboarding       (optional referral-code step)
  └── /checkout         (optional referral-code field)
  └── /creator          (dashboard tab)

Edge Functions (api/creators/*)
  ├── apply.ts
  ├── me.ts
  ├── referral-codes.ts        (POST/GET/DELETE)
  ├── apply-referral.ts        (POST — user enters a code)
  ├── attribute-purchase.ts    (POST — SERVICE-ROLE ONLY; called from ticketing)
  └── payout-run.ts            (POST — admin; runs Stripe transfers)

api/admin/creator-verification.ts  (admin approve/reject)

Supabase
  ├── creator_profiles
  ├── referral_codes
  ├── referral_attributions
  ├── creator_payouts
  └── creator_verification_requests

Stripe Connect (reused from venue payouts)
  └── venue_payout_accounts (shared table; FK from creator_profiles)
```

## Fee Model
* 10% commission on `price_cents` of each linked ticket (default; per-venue
  override via config — follow-up).
* Platform absorbs Stripe transfer fees during ramp; revisit at >$10k/mo.
* No tax withheld at source (follow-up for 1099/W-9 + KYC gating).

## Attribution Rules
* A referral code applied via `apply-referral.ts` creates a `pending` row.
* On ticket purchase, `attribute-purchase.ts` picks the **most recent** (last-touch) pending row for the same `referred_user_id` within 30 days and links it.
* One attribution per ticket (`attributed_ticket_id` unique link).
* Self-referral is rejected at the `apply-referral` step AND defense-in-depth at `attribute-purchase`.

## Fraud Mitigation (summary — see the fraud playbook)
1. Self-referral blocked at two layers.
2. Rate limit: 5 codes/creator/day; 10 apply-referral calls/user/day.
3. Service-role-only writes on `referral_attributions` (RLS guarantees clients cannot INSERT/UPDATE).
4. Purchase-only commission (no view/click commission).
5. Claw-back procedure: flip `status` to `voided`, reverse transfer if already paid.

## Verification Guidelines
Minimum bar for `verified`:
* Public social with >=1k followers on one platform.
* >=5 previous pulses with non-trivial engagement.
* Valid identity (handled via Stripe Connect onboarding).

`elite` is invite-only; granted after sustained revenue + zero fraud signals for 90 days.

## KYC Checklist (admin)
- [ ] Stripe Connect account completed (`charges_enabled=true`).
- [ ] W-9 (US) or W-8BEN (non-US) on file via Stripe.
- [ ] Tax ID verified.
- [ ] No open fraud cases.
- [ ] Email verified.

## Payout Cadence
* Bi-weekly (Mon of even weeks, UTC).
* Min payout threshold: $25. Below threshold rolls over.
* `payout-run.ts` supports `?dry_run=1` to preview.

## Feature Flag
`VITE_CREATOR_ECONOMY_ENABLED=1` enables the UI. Default off in production.
