# Safety Kit - Architecture & Operations

**Status:** v1 scaffold (2026-04-17). Default OFF in prod, ON in dev.

Pair with the PRD at `docs/prd/safety-kit.md`.

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Pulse client (PWA)                    │
│                                                               │
│  SafetyHomeCard  StartSafeWalkSheet  ShareNightSheet          │
│  EmergencyContactsPage  PanicButton  ActiveSessionBanner      │
│              │                                                │
│     use-safety-session ── navigator.geolocation               │
│              │                                                │
└──────────────┼────────────────────────────────────────────────┘
               │ fetch /api/safety/*   + Bearer <supabase token>
               ▼
┌─────────────────────────────────────────────────────────────┐
│          Vercel serverless functions (api/safety/*)          │
│                                                               │
│  session/start  session/ping  session/end  session/trigger   │
│  contacts/verify  contacts/confirm  cron/check-expired       │
│                                                               │
│   ── api/_lib/notify.ts  (Twilio SMS + Supabase Realtime)    │
│   ── api/_lib/safety-server.ts  (auth, rate limit, helpers)  │
└──────────────┼──────────────────────────────────────────────┘
               │ service-role client
               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Supabase (postgres)                    │
│  emergency_contacts  safety_sessions  safety_pings           │
│  trusted_rides  contact_verification_codes  safety_audit     │
│  (all RLS owner-only, safety_responder role for admin)       │
└─────────────────────────────────────────────────────────────┘
```

## 2. Edge Functions

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/safety/session/start` | POST | Create a `safety_sessions` row. |
| `/api/safety/session/ping` | POST | Append a ping (rate-limited 1/5s). |
| `/api/safety/session/end` | POST | Flip state to `completed` or `cancelled`. |
| `/api/safety/session/trigger` | POST | Manual panic: flip to `alerted`, fan out SMS+push, audit. |
| `/api/safety/contacts/verify` | POST | Issue + SMS a 6-digit OTP (TTL 10 min). |
| `/api/safety/contacts/confirm` | POST | Redeem OTP, set `verified_at`. |
| `/api/safety/cron/check-expired` | GET | Vercel cron: alert expired sessions, purge old pings/OTPs. |

All routes:
- Preflight OPTIONS returns 200.
- Bearer auth via Supabase session token. Unauthed returns 401.
- When service-role env is missing, the endpoints degrade to a dev fallback
  that returns synthetic data instead of writing to the DB. This lets the PWA
  develop end-to-end on a box with no backend plumbing.

## 3. Cron registration

`vercel.json` now includes:

```json
{
  "crons": [
    { "path": "/api/safety/cron/check-expired", "schedule": "*/1 * * * *" }
  ]
}
```

- Schedule: every 60 seconds. Vercel Hobby plan runs crons at min 1 minute
  granularity, which is our tightest SLA anyway.
- Vercel sends `Authorization: Bearer $CRON_SECRET`. If `CRON_SECRET` env is
  not set the endpoint allows-all (dev). Always set it in production.
- Each invocation also purges `safety_pings` older than 30 days and expired
  OTP rows. This is idempotent and fast; it replaces a pg_cron job for now.

## 4. Data retention

| Table | Retention |
| --- | --- |
| `emergency_contacts` | Until user deletes or user account is deleted. |
| `safety_sessions` | 2 years (audit trail for any alert). |
| `safety_pings` | 30 days, purged by cron. |
| `trusted_rides` | 2 years. |
| `contact_verification_codes` | Until consumed or expired (10 min TTL); purged by cron. |
| `safety_audit` | 2 years; insert-only; contains the fan-out log for every alert. |

GDPR/CCPA coverage: all tables are owner-scoped, so existing Settings >
"Export My Data" picks them up with no extra work. Deletion cascades via the
`ON DELETE CASCADE` foreign keys to `profiles(id)`.

## 5. False-positive mitigation

- Panic button requires a **3-second hold** (`src/components/safety/PanicButton.tsx`).
  Releasing early cancels cleanly. Hold is cancelled on pointerleave so a
  sleeve drag doesn't fire it.
- Contacts MUST be verified via SMS OTP before they can ever receive an alert.
  Auto-alert cron filters to verified contacts only.
- Timer extends are first-class (`+10m`, `+30m`) so the user doesn't have to
  cancel and re-arm mid-walk.
- v2 will add a 60-second "are you OK?" toast before dispatching the SMS on
  expiry (see PRD §9).
- Rate-limit on ping endpoint stops a runaway client from spamming the DB.

## 6. Permission handling

`use-safety-session.ts` owns the geolocation lifecycle:

- Calls `watchPosition` with `enableHighAccuracy: true`, `maximumAge: 30s`.
- On error code 1 (PERMISSION_DENIED) we surface `permission: 'denied'` and
  **stop the watch**. No retries, no re-prompts. The `ActiveSessionBanner`
  displays a calm callout explaining the alert will still fire without a map.
- When `navigator.geolocation` is not defined we return `permission: 'unavailable'`
  and skip the watch entirely.

## 7. Legal disclaimer template

Any UI surface that can send an alert MUST display the following (paraphrasable
but preserving intent):

> Pulse Safety Kit is not an emergency service. It does not call 911 or contact
> law enforcement. When you press the alert button, Pulse sends SMS and
> in-app notifications to the contacts you selected. Standard carrier
> messaging rates may apply. Reply STOP to unsubscribe from any SMS you
> receive from Pulse.

Onboarding flow (v1.1) will require a one-time acknowledgement checkbox before
the user can trigger any alert.

## 8. Test plan

| Layer | Covered by | How |
| --- | --- | --- |
| Migration | `supabase db reset` locally | Run against a clean DB, verify RLS via `select auth.uid() = user_id`. |
| Notify helper | `src/lib/__tests__/notify.test.ts` | Fake fetch, assert correct Twilio payload + log-only fallback. |
| Safety client | `src/lib/__tests__/safety-client.test.ts` | Injected fetch, assert body shape + auth header. |
| Feature flag | `src/lib/__tests__/feature-flags.test.ts` (updated) | Already existed; adds `safetyKit`. |
| UI smoke | Playwright (deferred) | Add a scripted "start walk -> end walk" test in `e2e/safety.spec.ts`. |

Run: `bun run test src/lib` (vitest) after any change.

## 9. Operational runbook

- **Someone got an unexpected SMS:** check `safety_audit` for the matching
  session id; the payload contains the notification summary and trigger event.
  Reply STOP cleans the contact up on Twilio's side; we also respect
  unsubscribes by not re-sending after Twilio returns 21610.
- **Cron missed a run:** `/api/safety/cron/check-expired` is idempotent, so a
  delayed invocation still processes the queue. If you see pings piling up,
  hand-invoke the endpoint with the cron bearer.
- **Twilio down:** the trigger endpoint still writes the audit row and
  `contacts_notified` with `ok: false, provider: 'twilio', error: ...`. Run
  the retry manually or ship a background job (v2).

## 10. Follow-up tickets

See PRD §9 plus:

- SAFETY-110: pg_cron replacement for the Vercel cron + ping purge.
- SAFETY-111: Add a Playwright smoke covering timer expiry -> alerted state.
- SAFETY-112: Legal review of disclaimer copy with counsel.
- SAFETY-113: Twilio STOP webhook handler + `unsubscribed_at` column.
