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

## 11. Pre-launch checklist

Before flipping `VITE_SAFETY_KIT_ENABLED=true` in production, every box below
must be checked. Track completion in the launch ticket and attach evidence
(screenshots, log excerpts, sign-off initials) to the PR.

### 11.1 Required environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for the
`Production` environment (server-only vars must NOT be prefixed with `VITE_`):

| Name | Env scope | Purpose | Failure mode if unset |
| --- | --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Server (Production) | Twilio REST auth — account id. | All SMS fall back to `SAFETY_KIT_SMS_SUPPRESSED` logs. No delivery. |
| `TWILIO_AUTH_TOKEN` | Server (Production) | Twilio REST auth — bearer. | Same as above. |
| `TWILIO_FROM` | Server (Production) | Sending number in E.164 (e.g. `+15551234567`). | Same as above. |
| `CRON_SECRET` | Server (Production) | Shared secret on `Authorization: Bearer …` for `/api/safety/cron/check-expired`. | Endpoint is allow-all — ANYONE can trigger alerts / purge data. |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Server (Production) | Supabase server client used by every `/api/safety/*` route. | All routes return synthetic dev-fallback payloads; nothing persists. |
| `VITE_SAFETY_KIT_ENABLED` | Client (Production) | Public feature flag rendered in the bundle. | Default is `false` — no Safety Kit UI surfaces are visible. |

Generate `CRON_SECRET` with `openssl rand -hex 32`. Never commit it.

### 11.2 Twilio setup steps

1. **Create a messaging service** in the Twilio console. A Messaging Service
   (not a bare number) gives us pooled numbers, auto geo-match, and a single
   place to wire the STOP keyword.
2. **Register the number** (A2P 10DLC for US / short code / toll-free as
   appropriate) and complete the brand + campaign approval. Expect a
   3-5 business day lead time — do not schedule launch inside that window.
3. **Buy a dedicated sender** and assign it to the messaging service. Put the
   E.164 form in `TWILIO_FROM`.
4. **Enable STOP / HELP / START auto-replies** under Messaging Service →
   Opt-Out Management → Advanced Opt-Out. Confirm the copy matches our
   disclaimer in §7.
5. **Hold down a monthly spend cap** on the project (Billing → Usage
   Triggers) at ~2× expected monthly volume. Any abuse pump will trip this
   before a five-figure bill accrues.
6. **Add at least two on-call emails** to Twilio billing + deliverability
   alerts so a dropped campaign does not go unnoticed.
7. **Smoke test from staging**: hit `/api/safety/contacts/verify` with a
   known-verified test contact, confirm the SMS arrives end-to-end, and that
   the Twilio dashboard shows `delivered` (not just `queued`).
8. **Rotate `TWILIO_AUTH_TOKEN`** once 90-day key-rotation policy ticks over.
   Use the primary/secondary token flipper in the Twilio console to rotate
   without downtime (update Vercel env, redeploy, revoke old token).

### 11.3 Trust & Safety sign-off

The following must be signed off (initials + date) by T&S before launch:

- [ ] **Content policy review** — SMS body templates in `api/safety/session/trigger.ts`,
      `api/safety/contacts/verify.ts`, and `api/safety/cron/check-expired.ts`
      have been reviewed against the abuse-messaging policy. Templates are
      short, include the word "Pulse", include a map link only when location
      data is present, and attach "Reply STOP to unsubscribe." via
      `api/_lib/notify.ts`.
- [ ] **Abuse prevention** — Per-user and per-contact rate limits on
      `/api/safety/contacts/verify` (5/hour user, 3/hour per contact) and
      `/api/safety/session/trigger` (5/hour/user) have been load-tested.
      Brute-force guard on `/api/safety/contacts/confirm` (20/5min/user +
      DB-level `MAX_ATTEMPTS=5`) has been exercised.
- [ ] **Panic-button drill** — with a staging Twilio number and two verified
      test contacts:
  1. Arm a safe-walk session, let it expire; confirm `cron/check-expired`
     fans out SMS within 2 cron ticks (≤ 2 min).
  2. Long-press the panic button for 3+ seconds; confirm SMS + Supabase
     Realtime broadcast arrive, `safety_audit` row is inserted with
     `event='panic_trigger'`, and `contacts_notified` is populated.
  3. Release the panic button in under 3 seconds; confirm NO SMS is sent
     and NO audit row is written.
  4. Revoke the Twilio `from` number in the console mid-drill; confirm
     subsequent alerts log `SAFETY_KIT_SMS_SUPPRESSED` (reason=`twilio-http-4xx`)
     without throwing and the session still flips to `alerted`.
- [ ] **Legal disclaimer** — the copy in §7 is shown on every alert-capable
      surface (PanicButton, ActiveSessionBanner, StartSafeWalkSheet). Ensure
      the pre-alert acknowledgement checkbox ships with this release or is
      explicitly deferred in the launch ticket.
- [ ] **On-call runbook primed** — at least one eng + one T&S person is
      paged on Sentry alerts tagged `safety`. Dashboard link to `safety_audit`
      is pinned in the #on-call Slack channel.

### 11.4 Rollback

If anything goes wrong post-launch, the flag is the kill switch. Both the
client UI and (via routing guards + feature checks) the associated API calls
are gated on `VITE_SAFETY_KIT_ENABLED`:

```bash
# 1. Flip the flag off. Scope: production only.
vercel env rm VITE_SAFETY_KIT_ENABLED production
vercel env add VITE_SAFETY_KIT_ENABLED production
# (paste: false)

# 2. Redeploy without the flag ON. Do NOT wait for a full CI rebuild if the
#    incident is active — promote the most recent known-good deployment:
vercel rollback

# 3. Optional hard stop on SMS spend: revoke TWILIO_AUTH_TOKEN in the Twilio
#    console. Every sendSms() call will then log SAFETY_KIT_SMS_SUPPRESSED
#    (reason=twilio-http-401) and return ok:false without retrying.
```

Confirm the rollback worked by:

1. Hitting the PWA and verifying the Safety entrypoints are hidden.
2. Tailing `vercel logs` for `SAFETY_KIT_SMS_SUPPRESSED` and for a drop in
   `POST /api/safety/*` traffic.
3. Leaving the cron ON — it is idempotent and keeps alerting on any
   sessions still in `active`. Only disable the cron (`vercel.json`) if we
   need to stop auto-alerts entirely.
