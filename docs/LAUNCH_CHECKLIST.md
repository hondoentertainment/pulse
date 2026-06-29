# Launch Checklist

Sign-off checklist for public launch (Phase 3 — Launch Readiness). Complete each section before geo-gating a city with `VITE_LAUNCHED_CITIES`.

Related: [RELEASE_CHECKS.md](../RELEASE_CHECKS.md), [PRODUCTION_ROLLOUT.md](../PRODUCTION_ROLLOUT.md), [SECURITY.md](../SECURITY.md), [Support Runbook](SUPPORT_RUNBOOK.md).

---

## Product surface decision (launch blocker)

The codebase ships **two** product shells (see [ARCHITECTURE.md](../ARCHITECTURE.md)):

- **Pulse Signal** — the default production entry (`VITE_APP_MODE` unset or `signal`).
- **Venue discovery PWA** — opt-in via `VITE_APP_MODE=venue`.

| Item | Owner | Status |
|------|-------|--------|
| [ ] Decide the primary launch surface (Signal vs Venue) and document it here | Product | Pending sign-off |
| [ ] Confirm `VITE_APP_MODE` is set accordingly in the production Vercel project | Eng | |
| [ ] Confirm the non-launch shell is unreachable / clearly gated | Eng | |

> **Default today:** production deploys boot **Pulse Signal**. Switch to the venue shell only after an explicit product decision.

---

## Legal & Privacy

| Item | Owner | Status |
|------|-------|--------|
| [x] Privacy Policy linked from Settings (`/privacy.html`) — *publishing copy is Product-owned* | Product / Eng | Linked in code |
| [x] Terms of Service linked from Settings (`/terms.html`) — *publishing copy is Product-owned* | Product / Eng | Linked in code |
| [ ] Data retention documented in Privacy Policy (pulses, telemetry, Safety Kit) | Legal / Eng | |
| [ ] GDPR/CCPA **Export My Data** tested on staging (Settings → Data & Account) | Eng | |
| [ ] Account **Delete** tested on staging — verify auth user + profile removed | Eng | |
| [ ] Cookie / analytics disclosure if third-party analytics enabled | Product | |

---

## Security

| Item | Owner | Status |
|------|-------|--------|
| [ ] Auth enforced on all write APIs (`POST /api/pulses/create`, account delete, etc.) | Eng | Unit auth-guard tests in `api/_lib/__tests__/write-api-auth.test.ts` |
| [ ] `SUPABASE_SERVICE_ROLE_KEY` set in production only (never in client bundle) | Eng | |
| [ ] Stripe webhook signature verification enabled (`STRIPE_WEBHOOK_SECRET`) | Eng | |
| [ ] Ticket QR HMAC secret rotated and not committed (`TICKET_QR_SECRET`) | Eng | |
| [ ] Admin routes gated by `SUPABASE_ADMIN_EMAILS` or RLS admin role | Eng | |
| [ ] CSP / HSTS headers verified on production (`vercel.json`) | Eng | |
| [ ] Dependency audit: no unmitigated critical/high vulnerabilities | Eng | |

See [SECURITY.md](../SECURITY.md) for full priorities.

---

## Accessibility

| Item | Owner | Status |
|------|-------|--------|
| [ ] Lighthouse accessibility ≥ 0.95 on production build (CI warn threshold) | Eng | |
| [ ] Critical flows keyboard-navigable (onboarding, map, create pulse, settings) | Eng | |
| [x] Skip link + main landmark present (`#main-content`) — both shells | Eng | Done |
| [x] Global search overlay exposes `role="dialog"` + `aria-modal` + labelled input | Eng | Done |
| [ ] High contrast mode available in Settings | Eng | |
| [ ] Screen reader smoke on iOS VoiceOver or Android TalkBack | QA | |

See [accessibility-audit.md](accessibility-audit.md) for component-level findings.

---

## Operations & Support

| Item | Owner | Status |
|------|-------|--------|
| [ ] Support runbook reviewed — [SUPPORT_RUNBOOK.md](SUPPORT_RUNBOOK.md) | Ops | |
| [ ] On-call rotation defined (see runbook §8) | Ops | |
| [ ] Rollback tested on Vercel (promote previous deployment) | Eng | |
| [ ] `/api/health` monitored by uptime checker | Ops | |
| [ ] Sentry DSN configured for production (`VITE_SENTRY_DSN`) | Eng | |
| [x] Native push registration wired client-side (`usePushRegistration` on sign-in) | Eng | Done (web no-op) |
| [x] Push **delivery** implemented server-side (FCM HTTP v1 + APNs ES256/HTTP2) | Eng | Done — see env contract below |
| [x] Push fan-out wired (Safety Kit + `POST /api/push/test`) | Eng | Done |
| [x] Friend-pulse server push on `POST /api/pulses/create` | Eng | Done |
| [x] Notification prefs persisted in Supabase (`profiles.notification_settings`) | Eng | Done |
| [x] Dead push token pruning on FCM/APNs stale responses | Eng | Done |
| [ ] Push delivery credentials set in prod + tested on a real device | Eng | Needs creds + device test |

> **Push delivery env contract** (`api/_lib/push.ts`, all optional — a provider is skipped if its vars are unset):
>
> - **Android (FCM HTTP v1):** `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (service-account; `\n`-escaped PEM accepted).
> - **iOS (APNs):** `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (`.p8` contents), `APNS_BUNDLE_ID` (default `com.pulse.nightlife`), `APNS_HOST` (`api.push.apple.com` prod / `api.sandbox.push.apple.com`).
> - **Token store:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE` (reads `push_tokens`).
>
> With no provider env set the sender logs and returns `logOnly: true` — no network call, safe for CI/dev.
| [ ] Incident comms template ready (status page or team channel) | Ops | |

---

## Performance & Reliability

| Item | Owner | Status |
|------|-------|--------|
| [ ] LCP < 2.5s on 4G (Lighthouse CI / manual WebPageTest) | Eng | |
| [ ] PWA precache < 3 MB total | Eng | |
| [ ] Load test passed: discovery reads + pulse writes — `npm run load-test` | Eng | |
| [ ] Staging smoke + unit tests green on release branch | Eng | |
| [x] Pulse/venue fetch failures show a retry affordance (no silent blank states) | Eng | Done |
| [x] Empty markets show a waitlist / "not live here yet" state (no blank feed) | Eng | Done |
| [ ] Feature flags OFF for unfinished surfaces (ticketing, safety, concierge) unless ready | Product | |

---

## Launch Geography

| Item | Owner | Status |
|------|-------|--------|
| [ ] `VITE_LAUNCHED_CITIES` set for first city (e.g. `Seattle,WA`) | Product | |
| [ ] Supabase venue seed verified for launch city | Eng | |
| [ ] Map + venue detail QA in launch city on real mobile devices | QA | |

> **Note (#3 validation):** run `npm run smoke:supabase` against the live project to validate the real data path — it checks REST auth, the `get_live_venue_intelligence` RPC, `venues`/`pulses` reads (with the live `deleted_at`/`expires_at` filters), and `push_tokens` presence. It is read-only and exits non-zero on failure, so it can gate the launch.
>
> ```bash
> SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run smoke:supabase
> ```
>
> E2E still runs against a deterministic in-bundle seed (`VITE_VISUAL_PREVIEW=true`), which validates the UI but not the Supabase data path — the smoke script covers that gap.

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Product | | |
| Legal / Privacy | | |
| Operations | | |

**Launch approved:** ☐ Yes ☐ No — blockers: _______________
