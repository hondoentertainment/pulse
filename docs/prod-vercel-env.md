# Production Vercel environment matrix

Recommended Production values for the Pulse Vercel project. Staging should mirror Production except where noted.

## Launch surface (required)

| Variable | Production | Notes |
|----------|------------|-------|
| `VITE_APP_MODE` | `venue` | **Venue decision PWA** — Seattle MVP per [PRD v1.0](PRD-v1.0-SEATTLE-MVP.md) |
| `VITE_ALLOW_VENUE_SHELL` | `true` | Required for venue shell in production builds |
| `VITE_SUPABASE_URL` | Live project URL | Required — prod blocks mock fallback without this |
| `VITE_SUPABASE_ANON_KEY` | Live anon key | Required |

## Feature flags (keep risky surfaces off)

| Variable | Production | Notes |
|----------|------------|-------|
| `VITE_TICKETING_ENABLED` | `false` | Until Stripe + QR HMAC creds verified |
| `VITE_AI_CONCIERGE_ENABLED` | `false` | Until AI provider creds configured |
| `VITE_CREATOR_ECONOMY_ENABLED` | `false` | Post-launch |
| `VITE_SAFETY_KIT_ENABLED` | `false` | Until Twilio creds configured |
| `VITE_VIDEO_FEED_ENABLED` | `false` | Q3 roadmap |

Safe to leave on (no extra secrets): `VITE_WEATHER_BOOST_ENABLED`, `VITE_WAIT_TIME_ENABLED`, `VITE_ACCESSIBILITY_FILTER_ENABLED`.

## Server-only (never prefix with `VITE_`)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Push fan-out, friend notifications, account delete |
| `SUPABASE_ADMIN_EMAILS` | Recommended | Comma-separated admin emails for `/api/keys/generate`, cross-user push test |
| `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | For Android push | Optional until device QA |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` | For iOS push | Optional until device QA |
| `VITE_SENTRY_DSN` | Recommended | Client error monitoring |
| `STRIPE_WEBHOOK_SECRET` | When ticketing on | |
| `TICKET_QR_SECRET` | When ticketing on | Rotate per environment |

## GitHub Actions secrets (CI)

| Secret | Used by |
|--------|---------|
| `SUPABASE_URL` | `supabase-smoke` job on PRs and main |
| `SUPABASE_ANON_KEY` | `supabase-smoke` job |

## Launch geography

| Variable | When ready |
|----------|------------|
| `VITE_LAUNCHED_CITIES` | e.g. `Seattle,WA` after venue seed QA |

## Monitoring

Point uptime checks at `GET /api/health` on the production domain. Expected: `200 { "status": "ok", ... }`.

Local probe (for cron / Better Stack / UptimeRobot):

```bash
npm run check:health -- https://pulse-chi-nine.vercel.app
# or
HEALTH_URL=https://pulse-chi-nine.vercel.app npm run check:health
```
