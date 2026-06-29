# API Reference

Pulse exposes serverless routes under `/api/*`, deployed as Vercel Functions. The browser calls them via `src/lib/api-client.ts` (same-origin, no CORS in production).

**Auth:** Most routes expect `Authorization: Bearer <supabase-jwt>`. Admin routes additionally require the caller's email in `SUPABASE_ADMIN_EMAILS`.

**Responses:** Handlers return JSON. Success payloads are typically `{ data: T }`. Errors return `{ error: string }` with an appropriate HTTP status.

> Local Vite dev does not serve `/api/*`. Use `vercel dev` or a preview deployment to exercise server routes locally.

---

## Pulses

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/pulses/create` | JWT | Create pulse with server moderation + rate limit (10/hr) |
| `GET` | `/api/pulses/list` | JWT | Paginated pulse feed |
| `POST` | `/api/pulses` | — | Legacy in-memory store (offline replay prototype) |

## Venues

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/venues/list` | JWT | RLS-scoped venue catalog (`limit`, `offset`) |

## Events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/events` | — | List events (prototype in-memory store) |
| `POST` | `/api/events` | — | Create event (prototype) |

## Integrations

Proxies that keep third-party secrets server-side. See [Secrets & Integrations](secrets-and-integrations.md).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/integrations/geocode` | — | Reverse geocode (`lat`, `lng`, `provider=mapbox\|google`) |
| `GET` | `/api/integrations/spotify` | varies | `op=search` (public) or `op=playlists` (JWT + `X-Spotify-Token`) |
| `POST` | `/api/integrations/uber` | JWT | Ride price/time estimates |
| `POST` | `/api/integrations/lyft` | JWT | Ride price/time estimates |

## Weather & Wait Time

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/weather/current` | — | Open-Meteo forecast (`lat`, `lng`) |
| `GET` | `/api/wait-time/estimate` | JWT | Venue wait-time estimate (`venueId`) |
| `GET` | `/api/wait-time/recompute` | cron | Recompute wait times (Vercel cron, every 10 min) |

## AI Concierge

Requires `ANTHROPIC_API_KEY` and `VITE_AI_CONCIERGE_ENABLED=1`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/concierge/chat` | JWT | Streaming Claude chat with venue tools |

## Ticketing & Reservations

Requires Stripe env vars. Gated by `VITE_TICKETING_ENABLED`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/ticketing/purchase` | JWT | Create Stripe PaymentIntent |
| `POST` | `/api/ticketing/confirm` | JWT | Confirm purchase after client payment |
| `POST` | `/api/ticketing/cancel` | JWT | Cancel unpaid intent |
| `POST` | `/api/ticketing/refund` | JWT | Refund paid ticket |
| `POST` | `/api/ticketing/transfer` | JWT | Transfer ticket to another user |
| `POST` | `/api/ticketing/verify` | staff | Scan QR at door (HMAC verification) |
| `GET` | `/api/ticketing/mine` | JWT | List caller's tickets |
| `POST` | `/api/reservations/request` | JWT | Request table reservation |
| `POST` | `/api/reservations/update` | JWT | Update reservation status |
| `POST` | `/api/webhooks/stripe` | Stripe sig | Payment webhook (ticket state transitions) |
| `POST` | `/api/stripe/webhook` | Stripe sig | Alternate Stripe webhook entry |

## Creator Economy

Gated by `VITE_CREATOR_ECONOMY_ENABLED`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/creators/me` | JWT | Creator profile |
| `POST` | `/api/creators/apply` | JWT | Apply for creator status |
| `GET` | `/api/creators/referral-codes` | JWT | List referral codes |
| `POST` | `/api/creators/referral-codes` | JWT | Create referral code |
| `DELETE` | `/api/creators/referral-codes` | JWT | Deactivate code (`?code=`) |
| `POST` | `/api/creators/apply-referral` | JWT | Redeem referral at checkout |
| `POST` | `/api/creators/attribute-purchase` | service role | Attribute purchase to creator |
| `POST` | `/api/creators/payout-run` | admin | Trigger payout batch |
| `POST` | `/api/venue-payouts/onboarding` | JWT | Stripe Connect onboarding for venues |

## Video Feed

Gated by `VITE_VIDEO_FEED_ENABLED`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/video/feed` | JWT | Paginated vertical feed (`cursor`, `limit`, `lat`, `lng`) |
| `POST` | `/api/video/upload-url` | JWT | Signed upload URL for video pulse |
| `POST` | `/api/video/publish` | JWT | Publish uploaded video pulse |
| `POST` | `/api/video/report` | JWT | Report video content |

## Safety Kit

Requires Twilio + Supabase service role. Gated by `VITE_SAFETY_KIT_ENABLED`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/safety/session/start` | JWT | Start safety session |
| `POST` | `/api/safety/session/ping` | JWT | Heartbeat ping |
| `POST` | `/api/safety/session/end` | JWT | End session normally |
| `POST` | `/api/safety/session/trigger` | JWT | Trigger emergency alert |
| `POST` | `/api/safety/contacts/verify` | JWT | Send OTP to trusted contact |
| `POST` | `/api/safety/contacts/confirm` | JWT | Confirm contact OTP |
| `GET` | `/api/safety/cron/check-expired` | cron | Expire stale sessions (every 1 min) |

## Push Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/push/register` | JWT | Register device push token |
| `POST` | `/api/push/unregister` | JWT | Remove device token |
| `POST` | `/api/push/test` | JWT | Send test push to self (admin may target any user) |

## Moderation & Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/moderation/check` | JWT | Server-side content moderation check |
| `POST` | `/api/admin/venue-metadata` | admin | Update venue structured metadata |
| `POST` | `/api/admin/creator-verification` | admin | Approve/reject creator applications |

## Utilities

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/keys/generate` | admin | Generate API keys for integrations |
| `POST` | `/api/webhooks/sign` | JWT | HMAC-sign outbound webhook payloads |

---

## Client usage

```typescript
import { createPulse } from '@/lib/api-client'

const result = await createPulse(
  { venueId, energyRating: 'buzzing', caption: 'Packed dance floor' },
  { accessToken: session.access_token },
)

if (result.ok) {
  console.log(result.data)
} else {
  console.error(result.status, result.error)
}
```

## Account (GDPR / CCPA)

Requires Supabase Auth. Deletion additionally requires `SUPABASE_SERVICE_ROLE_KEY` on the server.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/account/export` | JWT | Download JSON bundle of caller's personal data (10/hr rate limit) |
| `POST` | `/api/account/delete` | JWT | Permanently delete account; body `{ "confirm": "DELETE" }` (3/day limit) |
| `GET` | `/api/account/notification-settings` | JWT | Read notification preferences |
| `PATCH` | `/api/account/notification-settings` | JWT | Partial update of notification preferences |

Client helpers: `src/lib/account-privacy.ts`. UI: Settings → Data & Account.

## Shared libraries (`api/_lib/`)

| Module | Purpose |
|--------|---------|
| `auth.ts` | JWT verification, admin allowlist, venue staff checks |
| `http.ts` | CORS, preflight, response helpers |
| `rate-limit.ts` | Per-user/IP rate limiting |
| `moderation.ts` | Caption/content moderation |
| `supabase-server.ts` | User-scoped and service-role Supabase clients |
| `stripe.ts` | Stripe API helpers |
| `notify.ts` | SMS (Twilio) and push delivery |
| `concierge-tools.ts` | AI Concierge tool implementations |
| `account-lifecycle.ts` | GDPR export tables + account deletion helpers |

## Cron jobs

Defined in `vercel.json`:

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/wait-time/recompute` | `*/10 * * * *` | Refresh wait-time estimates |
| `/api/safety/cron/check-expired` | `*/1 * * * *` | Expire stale safety sessions |

## Related docs

- [Secrets & Integrations](secrets-and-integrations.md) — env vars per route
- [Backend Migration](backend-migration.md) — Supabase schema behind these routes
- Feature guides: [AI Concierge](ai-concierge.md), [Ticketing](payments.md), [Safety Kit](safety-kit.md), [Video Feed](video-feed.md)
