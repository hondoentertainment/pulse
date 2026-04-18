# Payments

This document covers the end-to-end ticketing payment flow, from the
buyer hitting "Purchase" to a staff member scanning the QR at the door.
All of the UI described here is behind the `ticketing` feature flag
(defaults to off).

## High-level flow

```
┌────────────┐  1. reserve + create PaymentIntent   ┌─────────────────────┐
│  Buyer UI  │ ─────────────────────────────────▶  │ /api/ticketing/     │
│ Ticket…Sheet│                                     │   purchase          │
└─────▲──────┘                                     └─────────┬───────────┘
      │ 2. client_secret                                     │
      │ 3. mount PaymentElement                              │
      │ 4. confirmPayment (Stripe.js)                        │
      │                                                      │
      │ 5. paymentIntent.status === 'succeeded'              │
      │ 6. POST /api/ticketing/confirm ──────────────────────┘
      │
      │ 7. issue QR (PULSE-TKT:<ticketId>:<userId>:<hmac>)
      ▼
  My Tickets
```

## Elements flow

1. `TicketPurchaseSheet` calls `POST /api/ticketing/purchase` with the
   reserved ticket IDs + amount.
2. The server creates a Stripe PaymentIntent and returns `client_secret`.
3. The client mounts `<PaymentElementMount>` which wraps
   `stripe.elements({ clientSecret })` + `.create('payment')` +
   `.mount(container)`.
4. On "Pay now" the client calls `confirmPayment` from
   `src/lib/stripe-client.ts` with `redirect: 'if_required'`.
5. On `paymentIntent.status === 'succeeded'`, the sheet advances to a
   success state. `POST /api/ticketing/confirm` is then called server-side
   (or via the app) to flip the ticket status to `paid` and generate the
   HMAC QR secret.

## Cancel / refund reconciliation

- **Cancel** (`POST /api/ticketing/cancel`): buyer aborts after the
  PaymentIntent was created. Handler cancels the PI via Stripe REST
  (`/v1/payment_intents/{id}/cancel`), flips `tickets.status='cancelled'`,
  and **re-increments** `events.ticket_types[type].remaining` so capacity
  is reconciled. Rate-limited per caller token.
- **Refund** (existing endpoint): applies the tiered refund policy (100%
  > 48h, 50% > 24h, 0% < 24h) and refunds via Stripe. Capacity is
  **not** reclaimed once paid — the seat was consumed once the event
  starts.

## Staff scanner workflow

1. Staff open `StaffScannerPage`. We check:
   - `featureFlags.ticketing === true`, and
   - `useVenueStaffStatus()` returns `isStaff: true`.
2. The page uses the `BarcodeDetector` API if available; otherwise it
   falls back to manual code entry.
3. Each scan calls `POST /api/ticketing/verify` with the raw QR payload.
4. The server:
   - parses the envelope,
   - verifies the HMAC with `TICKET_HMAC_SECRET`,
   - looks up the ticket + caller's staff rows,
   - runs `canScan({ callerRole, callerUserId, ticketVenueId, staffRows })`,
   - idempotently flips status to `scanned` within a 5-minute window and
     returns `already_scanned` inside that window,
   - returns `{ status, ticketId, attendeeInitials, ticketType, scannedAt }`.

## HMAC verification details

- Payload format: `PULSE-TKT:<ticketId>:<userId>:<hmac>` where `hmac` is
  `HMAC-SHA256(secret, "<ticketId>:<userId>")` hex-encoded.
- Secret: `TICKET_HMAC_SECRET` env var. Never shared with the client.
- Comparison: constant-time hex equality (`hmacEquals`) to reduce
  timing-attack surface.
- Rotation: plan to support dual-key rotation via
  `TICKET_HMAC_SECRET_NEXT` before invalidating the old secret.

## Role gating

The staff endpoint (`/api/ticketing/verify`) accepts a caller as staff if
**either** of the following holds:

- JWT claim `app_metadata.role === 'venue_staff'` (platform-wide staff
  shortcut, useful during onboarding), OR
- A row in `venue_staff` matching `(ticket.venue_id, caller.id)`.

Both checks are also enforced at the database level by RLS on the
`tickets` scan-update policy (see
`supabase/migrations/20260417000007_ticket_scans.sql`).

## Env vars

| Var                              | Purpose                                |
| -------------------------------- | -------------------------------------- |
| `VITE_STRIPE_PUBLISHABLE_KEY`    | Loaded by `stripe-loader.ts` (client)  |
| `STRIPE_SECRET_KEY`              | Server-side Stripe REST calls         |
| `TICKET_HMAC_SECRET`             | HMAC key for QR payloads              |
| `SUPABASE_URL`                   | Service-role Supabase client          |
| `SUPABASE_SERVICE_ROLE_KEY`      | Service-role Supabase client          |
| `VITE_FF_ENABLE_TICKETING=true`  | Turns on the ticketing UI             |
