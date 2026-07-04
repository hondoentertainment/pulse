# Feature Flags

Pulse gates optional surfaces behind environment variables. All flags are read at build time via Vite (`import.meta.env`) and baked into the client bundle.

**Source of truth:** `src/lib/feature-flags.ts` and `src/lib/video-feature-flag.ts`.

Accepted truthy values: `1`, `true`, `yes`, `on`  
Accepted falsy values: `0`, `false`, `no`, `off`

## Core flags (`featureFlags`)

| Flag key | Env variable | Default | Gated behavior |
|----------|--------------|---------|--------------|
| `integrations` | `VITE_FF_ENABLE_INTEGRATIONS` | `true` | Spotify, Uber, Lyft integration UI |
| `socialDashboard` | `VITE_FF_ENABLE_SOCIAL_DASHBOARD` | `true` | Social pulse / X correlation dashboard |
| `smartMap` | `VITE_FF_ENABLE_SMART_MAP` | `true` | Enhanced map features |
| `weatherBoost` | `VITE_WEATHER_BOOST_ENABLED` | `true` | Weather-aware venue ranking (`useWeather`) |
| `waitTime` | `VITE_WAIT_TIME_ENABLED` | `true` | Wait-time chip on venue cards |
| `accessibilityFilter` | `VITE_ACCESSIBILITY_FILTER_ENABLED` | `true` | Accessibility section in map filters |
| `safetyKit` | `VITE_SAFETY_KIT_ENABLED` | `true`* | Safety Kit UI (contacts, sessions) |
| `ticketing` | `VITE_TICKETING_ENABLED` | `false` | Ticket purchase, QR codes, staff scanner |
| `aiConcierge` | `VITE_AI_CONCIERGE_ENABLED` | `false` | AI night-planning chat sheet |
| `creatorEconomy` | `VITE_CREATOR_ECONOMY_ENABLED` | `false` | Creator tab, referrals, payouts |

\* Safety Kit defaults to on in dev (`.env.example`) but should stay **off in production** until Twilio and server env are configured. See [Safety Kit](safety-kit.md).

### Usage in code

```typescript
import { isFeatureEnabled } from '@/lib/feature-flags'

if (isFeatureEnabled('ticketing')) {
  // render TicketPurchaseSheet
}
```

## Video feed (separate module)

| Env variable | Default | Notes |
|--------------|---------|-------|
| `VITE_VIDEO_FEED_ENABLED` | `false` | Vertical video pulse surfaces |

Resolved by `src/lib/video-feature-flag.ts`. See [Video Feed](video-feed.md).

## Data layer

| Env variable | Default | Notes |
|--------------|---------|-------|
| `VITE_USE_SUPABASE_BACKEND` | auto | `true`/`false` override; auto-on when Supabase creds present |

See [Data Layer](data-layer.md).

## Operational / resilience

| Env variable | Default | Notes |
|--------------|---------|-------|
| `VITE_PULSE_READ_ONLY_MODE` | off | Disables writes client-side during outages |
| `VITE_LAUNCHED_CITIES` | empty | Comma-separated city allowlist for geo launch |

## Observability

| Env variable | Default | Notes |
|--------------|---------|-------|
| `VITE_ANALYTICS_BACKEND` | `console` (dev) | `amplitude`, `posthog`, or `console` |
| `VITE_AMPLITUDE_API_KEY` | — | Required for Amplitude adapter |
| `VITE_POSTHOG_API_KEY` | — | Required for PostHog adapter |
| `VITE_POSTHOG_HOST` | `https://app.posthog.com` | PostHog ingest URL |
| `VITE_SENTRY_DSN` | — | Client error tracking |
| `VITE_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `VITE_LOG_SINK_URL` | — | Remote log sink (Datadog, Logtail, etc.) |

See [Observability](observability.md).

## Maps & location

| Env variable | Scope | Notes |
|--------------|-------|-------|
| `VITE_MAPBOX_TOKEN` | client | Public, URL-restricted tile token |
| `MAPBOX_SERVER_TOKEN` | server | Geocoding (separate from tile token) |

## Payments (ticketing)

| Env variable | Scope | Notes |
|--------------|-------|-------|
| `VITE_TICKETING_ENABLED` | client | Master UI flag |
| `VITE_STRIPE_PUBLISHABLE_KEY` | client | Stripe.js publishable key |
| `STRIPE_SECRET_KEY` | server | Payment intents, refunds |
| `STRIPE_WEBHOOK_SECRET` | server | Webhook signature verification |

See [Payments](payments.md).

## Testing & CI

| Env variable | Used by | Notes |
|--------------|---------|-------|
| `VITE_E2E_AUTH_BYPASS` | Playwright | Skips auth in smoke tests |
| `VITE_VISUAL_PREVIEW` | Playwright | Visual regression mode |
| `PLAYWRIGHT_BASE_URL` | Playwright | Override preview URL |

## Per-environment recommendations

### Local dev (mock data)

```env
VITE_FF_ENABLE_INTEGRATIONS=true
VITE_FF_ENABLE_SOCIAL_DASHBOARD=true
VITE_FF_ENABLE_SMART_MAP=true
```

### Staging (Supabase + selective features)

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TICKETING_ENABLED=1
VITE_AI_CONCIERGE_ENABLED=1
VITE_SAFETY_KIT_ENABLED=0
```

### Production

Enable features only after their server secrets and runbooks are ready. Prefer gradual rollout:

1. Ship with flag `false`
2. Enable in staging, run [RELEASE_CHECKS.md](../RELEASE_CHECKS.md)
3. Canary in production (5% traffic or internal users)
4. Full enable + monitor SLOs

## Related docs

- [Differentiators](differentiators.md) — weather, wait time, accessibility pack
- [Secrets & Integrations](secrets-and-integrations.md) — required env per integration
- PRDs under `docs/prd/` — feature-specific rollout criteria
