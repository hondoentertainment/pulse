# PRD — Reservations, Ticketing & Cover Charges (Q1)

Owner: Platform / Monetisation.
Status: Scaffold complete, behind `VITE_TICKETING_ENABLED` flag.
Dependencies: Supabase (service role), Stripe Connect (Express), Vercel Edge Functions.

## Why
Pulse currently surfaces venues and events but captures zero transactional revenue. Three primitives — covers, tickets, table reservations — close that loop and let us take a platform fee on every booking.

## User stories

### Patron
- As a patron, I can buy a ticket (GA / VIP / guest list) for a published event and receive a scannable QR in my phone.
- As a patron, I can cancel a ticket ≥24 h before the event and be refunded automatically.
- As a patron, I can transfer a ticket to a friend via a one-time token.
- As a patron, I can request a table at a venue, optionally with a deposit, and see its status (requested → confirmed → seated).

### Venue
- As a venue owner, I can onboard to Stripe Connect in under 10 minutes and begin receiving payouts next business day.
- As venue staff, I can see a list of incoming reservations and transition their status.
- As venue staff, I can scan a QR at the door and confirm a ticket's validity.

### Platform
- As Pulse, I charge a configurable platform fee (bps) on every transaction and settle the remainder to the venue via Stripe Connect `transfer_data`.
- As Pulse, I receive webhook events from Stripe and reconcile them idempotently.

## Entities

- `venue_payout_accounts` — 1:1 with `venues`. Stores `stripe_account_id`, status, feature flags (`charges_enabled`, `payouts_enabled`, `details_submitted`).
- `events` — extended with `starts_at`, `ends_at`, `cover_price_cents`, `capacity`, `ticket_types` (jsonb array of `{name, price_cents, qty, remaining}`), `currency`, `status`.
- `tickets` — `event_id`, `user_id`, `ticket_type`, `price_cents`, `status` (pending/paid/refunded/transferred/cancelled), `stripe_payment_intent`, `qr_code_secret`, `transferable_to_user_id`, `transfer_token`.
- `reservations` — `venue_id`, `user_id`, `party_size`, `starts_at`, `status` (requested/confirmed/seated/cancelled/no_show/completed), `deposit_cents`, `deposit_payment_intent`, `notes`.
- `stripe_webhook_events` — idempotency ledger keyed on Stripe `event.id`.
- `venue_staff` — authorisation mapping. (Choice rationale: a table is cheaper to evolve than `app_metadata.venue_ids` JWT claim; tokens don't need to be reissued when staff change. The claim variant can be layered on later for hot-path reads.)

## Flows

### Purchase
1. Client POSTs `/api/ticketing/purchase` with `{ event_id, ticket_type }`.
2. Server verifies event is `published`, decrements `remaining` on the tier (compare-and-swap on the jsonb), inserts a `pending` ticket, and creates a Stripe PaymentIntent with `transfer_data[destination]` set to the venue's connected account and `application_fee_amount` set to the platform cut.
3. Client receives `client_secret` and confirms via Stripe Elements.
4. Client POSTs `/api/ticketing/confirm` for optimistic UI; webhook `payment_intent.succeeded` is the source of truth.
5. On confirmation the ticket status flips to `paid`, a QR secret (HMAC of `ticket_id:user_id` keyed by server secret) is generated.

### Refund
1. Client or staff POSTs `/api/ticketing/refund`.
2. Server validates: ticket is `paid`, event is in the future, ≥24 h remaining. Staff may `force: true` to override.
3. Full refund via `POST /refunds`; ticket flipped to `refunded`; webhook `charge.refunded` mirrors state.

### Transfer
1. Owner POSTs `/api/ticketing/transfer` with `action: 'initiate'` and recipient user id. Server sets `transferable_to_user_id` and returns a random `transfer_token`.
2. Recipient POSTs with `action: 'accept'` plus the token. Server swaps ownership once (`transferred_at` is set to prevent chain transfers).

### Resale
Out of scope for Q1 — transfers are peer-to-peer and price-capped via product policy (not enforced on-chain). Follow-up ticket tracks a managed resale market with price caps per tier.

### Venue onboarding (Stripe Connect)
1. Admin POSTs `/api/venue-payouts/onboarding` with `{ venue_id, refresh_url, return_url }`.
2. Server creates an Express account if none exists, upserts `venue_payout_accounts`, creates an AccountLink and returns the URL.
3. Admin completes Stripe's hosted onboarding. `account.updated` webhook syncs status back.

## Edge cases
- **Sold out**: capacity decrement races are handled by a compare-and-swap on the `ticket_types` jsonb. Losing writes receive 400 `sold_out`.
- **Group bookings**: current endpoints are single-seat. Group splits remain in the existing mock layer for now; the real flow will lean on a single PaymentIntent with allocation metadata.
- **Split payments**: deferred; PaymentIntent pattern supports `application_fee_amount` but splitting across patrons requires a sub-orders model.
- **Deposit reservations**: deposit is collected up-front via a PaymentIntent; no-show charges the remainder at staff's discretion (follow-up ticket).
- **Failed payments**: webhook sets the ticket to `cancelled`, releasing implicit capacity (reconciliation job re-adds to `remaining`, tracked separately).
- **Stripe disabled**: if a venue hasn't onboarded, we bypass `transfer_data` and credit the platform account. A reconciliation tool will later pay the venue out of band.

## Fee model
`PLATFORM_FEE_BPS` (default 1000 = 10%) applied to gross. Charged via `application_fee_amount` on the PaymentIntent. Stripe's own processing fee comes out of the remainder on the venue's side.

## Risks
- **Chargebacks**: patron disputes land on the connected account. We surface disputes via `charge.dispute.created` (not yet handled — follow-up).
- **Fraud**: high-value VIP tickets are an attack surface; Stripe Radar rules will be added per-connected-account. Transfer token reuse is blocked (single `transferred_at` timestamp).
- **Capacity drift**: our decrement lives in jsonb. If a future schema ships normalised `ticket_type` rows, migrate with a transaction.
- **PII**: QR secrets are HMAC, not reversible; we never store card data (Stripe tokenises).
