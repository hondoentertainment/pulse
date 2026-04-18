# Payments — Stripe Connect money flow

## Topology

```
 Patron (card) ─▶ Stripe ─▶ Connected account (venue)
                    │             │
                    │             └─ payout to bank (T+2)
                    └─ application_fee_amount  ─▶ Pulse platform account
```

We use the **destination-charge** model: one PaymentIntent is created on the
Pulse platform account with `transfer_data[destination]` pointing at the
venue's connected (Express) account. Stripe routes funds net of
`application_fee_amount` to the venue; our platform fee stays on our balance.

If a venue is not yet onboarded (no `stripe_account_id` on
`venue_payout_accounts`), the PaymentIntent is created *without*
`transfer_data` — the full amount lands on the platform account and is
reconciled out-of-band. This is a deliberate fallback for Q1; once all
active venues are onboarded the fallback can be removed.

## Fee split

- `PLATFORM_FEE_BPS` — basis points, default **1000 (10 %)**. Configured via
  env; used by `api/_lib/fees.ts`.
- Stripe's processing fee (~2.9 % + $0.30 US) is borne by the *connected
  account* in this model — adjust platform fees accordingly when pricing.

## Refund policy

- `>= 24 h` before `events.starts_at`: automatic full refund.
- `< 24 h`: refund blocked for owners; venue staff can still `force: true`.
- Fees are not refunded to patrons at the platform level; follow-up ticket
  to expose `refund_application_fee: true` on staff-forced refunds.

## Environment variables

| Variable | Where | Required | Notes |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Edge Functions (server) | yes | `sk_test_…` in dev |
| `STRIPE_WEBHOOK_SECRET` | Edge Functions (server) | yes (for webhook) | from `stripe listen` or dashboard endpoint |
| `STRIPE_PUBLISHABLE_KEY` | Client build | yes (prod) | referenced in client as `VITE_STRIPE_PUBLISHABLE_KEY` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client build | yes (prod) | same value as above; Vite only exposes `VITE_` prefixed vars |
| `PLATFORM_FEE_BPS` | Edge Functions | no | default 1000 (10 %) |
| `QR_SECRET` | Edge Functions | no | HMAC key for QR fingerprints; falls back to `STRIPE_SECRET_KEY` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | yes | service-role client factory |
| `VITE_TICKETING_ENABLED` | Client build | no | feature flag; `1` to enable |

## Testing in Stripe test mode

1. `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` and `STRIPE_SECRET_KEY=sk_test_...`.
2. Use `stripe listen --forward-to localhost:3000/api/stripe/webhook` for
   webhook-signed deliveries; copy the printed `whsec_...` into
   `STRIPE_WEBHOOK_SECRET`.
3. Onboard a test venue via the `PayoutOnboarding` component. Use Stripe's
   test identity shortcut: use `000-00-0000` for SSN, address `address_full_match`,
   DOB `1901-01-01`.
4. Buy a ticket with card `4242 4242 4242 4242`. Expect:
   - `tickets.status = pending` after `/api/ticketing/purchase`.
   - `tickets.status = paid` after `payment_intent.succeeded` webhook fires.
5. Refund via Stripe dashboard → expect `tickets.status = refunded`.

## How to add a new ticket type

Ticket types live on the `events.ticket_types` jsonb column. Example patch:

```sql
update events
set ticket_types = ticket_types || jsonb_build_object(
  'name', 'early_bird',
  'price_cents', 1500,
  'qty', 50,
  'remaining', 50
)::jsonb
where id = '...';
```

Clients reference the tier by `ticket_type = 'early_bird'` when calling
`/api/ticketing/purchase`. The server validates presence and decrements
`remaining` atomically via a compare-and-swap on the jsonb.

## Troubleshooting

- **`sold_out` on purchase**: the `remaining` counter hit zero, or a CAS
  race was lost. Retry; persistent failure means the tier really is sold out.
- **`outside_refund_window`**: < 24 h to event. Staff can force via UI.
- **`invalid_signature` on webhook**: verify `STRIPE_WEBHOOK_SECRET` matches
  the endpoint in Stripe's dashboard. Raw body must be untouched —
  `config.api.bodyParser = false` is set in `api/stripe/webhook.ts`.
