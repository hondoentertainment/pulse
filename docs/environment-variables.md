# Environment Variables

Master reference for all Pulse environment variables. Consolidates [Feature Flags](feature-flags.md) and [Secrets & Integrations](secrets-and-integrations.md).

**Rule:** Only `VITE_*` vars are exposed to the client bundle. Everything else is server-only.

---

## Quick setup

```bash
cp .env.example .env
```

Minimum for local dev: **no vars required** (mock data mode).

---

## Core platform

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `VITE_SUPABASE_URL` | client + server | prod | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client + server | prod | Public anon key |
| `SUPABASE_URL` | server | optional | Override for Edge Functions |
| `SUPABASE_ANON_KEY` | server | optional | Override for Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | server | prod | Privileged DB access — **never expose** |
| `SUPABASE_DB_URL` | local CLI | migrations | Direct Postgres connection string |
| `SUPABASE_ADMIN_EMAILS` | server | admin routes | Comma-separated admin allowlist |
| `VITE_USE_SUPABASE_BACKEND` | client | optional | Force mock (`false`) or Supabase (`true`) |

---

## Feature flags (client)

| Variable | Default | Feature |
|----------|---------|---------|
| `VITE_FF_ENABLE_INTEGRATIONS` | `true` | Spotify/Uber/Lyft UI |
| `VITE_FF_ENABLE_SOCIAL_DASHBOARD` | `true` | Social pulse dashboard |
| `VITE_FF_ENABLE_SMART_MAP` | `true` | Enhanced map |
| `VITE_WEATHER_BOOST_ENABLED` | `true` | Weather ranking |
| `VITE_WAIT_TIME_ENABLED` | `true` | Wait-time chips |
| `VITE_ACCESSIBILITY_FILTER_ENABLED` | `true` | Map accessibility filter |
| `VITE_SAFETY_KIT_ENABLED` | `true` dev / `false` prod | Safety Kit UI |
| `VITE_TICKETING_ENABLED` | `false` | Ticketing + scanner |
| `VITE_AI_CONCIERGE_ENABLED` | `false` | AI Concierge chat |
| `VITE_CREATOR_ECONOMY_ENABLED` | `false` | Creator tab |
| `VITE_VIDEO_FEED_ENABLED` | `false` | Video pulse feed |
| `VITE_PULSE_READ_ONLY_MODE` | off | Disable writes during outage |
| `VITE_LAUNCHED_CITIES` | empty | Geo launch allowlist |

Full detail: [Feature Flags](feature-flags.md).

---

## Maps & location

| Variable | Scope | Description |
|----------|-------|-------------|
| `VITE_MAPBOX_TOKEN` | client | Public tile token (URL-restricted) |
| `MAPBOX_SERVER_TOKEN` | server | Geocoding (separate token) |
| `GOOGLE_MAPS_SERVER_KEY` | server | Alternative geocoding provider |
| `OPEN_METEO_BASE_URL` | server | Weather API base (optional override) |

---

## Payments (Stripe)

| Variable | Scope | Description |
|----------|-------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | client | Stripe.js publishable key |
| `STRIPE_SECRET_KEY` | server | Payment intents, refunds |
| `STRIPE_WEBHOOK_SECRET` | server | Webhook signature verification |

---

## AI Concierge

| Variable | Scope | Description |
|----------|-------|-------------|
| `ANTHROPIC_API_KEY` | server | Claude API access |
| `CONCIERGE_MODEL` | server | Model override (default in handler) |
| `CONCIERGE_SESSION_CENTS_CAP` | server | Per-session cost cap |

---

## Safety Kit (Twilio)

| Variable | Scope | Description |
|----------|-------|-------------|
| `TWILIO_ACCOUNT_SID` | server | Twilio account |
| `TWILIO_AUTH_TOKEN` | server | Twilio auth |
| `TWILIO_FROM_NUMBER` | server | SMS sender (E.164) |

---

## Integrations

| Variable | Scope | Service |
|----------|-------|---------|
| `SPOTIFY_CLIENT_ID` | server | Spotify catalog |
| `SPOTIFY_CLIENT_SECRET` | server | Spotify OAuth |
| `UBER_SERVER_TOKEN` | server | Uber estimates |
| `LYFT_CLIENT_ID` | server | Lyft OAuth |
| `LYFT_CLIENT_SECRET` | server | Lyft OAuth |
| `WEBHOOK_HMAC_SECRET` | server | Outbound webhook signing |
| `WEBHOOK_HMAC_SECRET_<ID>` | server | Per-subscription override |

---

## Push notifications

| Variable | Scope | Description |
|----------|-------|-------------|
| `FCM_PROJECT_ID` | server | Firebase project id (FCM HTTP v1) |
| `FCM_CLIENT_EMAIL` | server | Service-account `client_email` |
| `FCM_PRIVATE_KEY` | server | Service-account PEM private key (`\n`-escaped ok) |
| `APNS_KEY_ID` | server | Apple Push Notification key id (`kid`) |
| `APNS_TEAM_ID` | server | Apple developer team id (`iss`) |
| `APNS_PRIVATE_KEY` | server | APNs `.p8` contents (PEM; `\n`-escaped ok) — preferred over legacy cert |
| `APNS_BUNDLE_ID` | server | iOS bundle id / `apns-topic` (default `com.pulse.nightlife`) |
| `APNS_HOST` | server | `api.push.apple.com` (prod) or `api.sandbox.push.apple.com` |

> **Deprecated:** `FCM_SERVER_KEY` (legacy server key API) is no longer used — migrate to FCM HTTP v1 vars above.

Native delivery is implemented in `api/_lib/push.ts`. With no provider env set the sender logs and returns `logOnly: true` (safe for dev/CI). Ops can verify wiring via `POST /api/push/test` after registering a device token.

---

## Observability

| Variable | Scope | Description |
|----------|-------|-------------|
| `VITE_SENTRY_DSN` | client | Error tracking |
| `VITE_ANALYTICS_BACKEND` | client | `console`, `amplitude`, `posthog` |
| `VITE_AMPLITUDE_API_KEY` | client | Amplitude project key |
| `VITE_POSTHOG_API_KEY` | client | PostHog project key |
| `VITE_POSTHOG_HOST` | client | PostHog ingest URL |
| `VITE_LOG_LEVEL` | client | `debug`, `info`, `warn`, `error` |
| `VITE_LOG_SINK_URL` | client | Remote log sink URL |

---

## Testing & CI

| Variable | Scope | Description |
|----------|-------|-------------|
| `VITE_E2E_AUTH_BYPASS` | client | Skip auth in Playwright |
| `VITE_VISUAL_PREVIEW` | client | Visual regression mode |
| `PLAYWRIGHT_BASE_URL` | CI | Override preview URL |
| `VITEST` | CI | Set by Vitest runner |

**Supabase data-path smoke** (`npm run smoke:supabase`): requires `SUPABASE_URL` plus one of `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`, or `SUPABASE_SERVICE_ROLE_KEY`. Read-only; exits non-zero on failure.

---

## Load testing

| Variable | Default | Description |
|----------|---------|-------------|
| `LOAD_TARGET_URL` | `http://localhost:5000` | Target URL |
| `LOAD_TARGET_RPS` | `25` | Requests per second |
| `LOAD_DURATION_S` | `30` | Test duration |
| `LOAD_RAMP_S` | `10` | Ramp-up period |
| `LOAD_CONCURRENCY` | `20` | Concurrent workers |

---

## Misc

| Variable | Scope | Description |
|----------|-------|-------------|
| `VITE_RESEARCH_FEEDBACK_URL` | client | Survey/Calendly link in Settings |
| `VITE_APP_VERSION` | client | App version for push registration |
| `VITE_API_BASE_URL` | client | API base override (tests) |
| `PROJECT_ROOT` | build | Vite project root override |

---

## Where to set variables

| Environment | Location |
|-------------|----------|
| Local dev | `.env`, `.env.local` (gitignored) |
| Vercel Preview | Project Settings → Environment Variables → Preview |
| Vercel Production | Project Settings → Environment Variables → Production |
| GitHub Actions | Repository Secrets (`VERCEL_TOKEN`, etc.) |
| Supabase | Dashboard → Settings → API (URL + keys) |

### Vercel CLI

```bash
vercel env add VITE_SUPABASE_URL production
vercel env pull .env.local
```

Redeploy after changing client (`VITE_*`) variables — they are baked in at build time.

---

## Rotation

See [Secrets & Integrations](secrets-and-integrations.md) for rotation procedures and smoke-test checklists per integration.

---

## Related docs

- [Feature Flags](feature-flags.md)
- [Secrets & Integrations](secrets-and-integrations.md)
- [Getting Started](getting-started.md)
- [Deployment Guide](deployment.md)
