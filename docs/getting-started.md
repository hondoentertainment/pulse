# Getting Started

This guide walks you from a fresh clone to a running Pulse dev environment.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Required for Vite, Vitest, Playwright |
| npm | 9+ | Bundled with Node; repo uses npm scripts |
| Git | any recent | Clone and branch for contributions |
| Docker | optional | Only needed for local Supabase (`supabase start`) |
| Supabase CLI | optional | `brew install supabase/tap/supabase` for local DB |

## 1. Clone and install

```bash
git clone <repo-url>
cd pulse
npm install
```

## 2. Environment variables

Copy the example env file and fill in values as needed:

```bash
cp .env.example .env
```

### Minimum for local dev (mock data)

No env vars are required. Without Supabase credentials the app boots against seeded mock fixtures in `src/lib/mock-data.ts`. You will see a console note:

```
[pulse] USE_SUPABASE_BACKEND is OFF — reads/writes use local mock fixtures.
```

### Supabase backend (recommended for full-stack work)

Add your project credentials from the [Supabase dashboard](https://supabase.com/dashboard):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

When both values are present and non-placeholder, the data layer automatically switches to Supabase. See [Data Layer](data-layer.md) for override flags.

### Optional client flags

```env
# Feature toggles (see docs/feature-flags.md)
VITE_FF_ENABLE_INTEGRATIONS=true
VITE_FF_ENABLE_SOCIAL_DASHBOARD=true
VITE_FF_ENABLE_SMART_MAP=true

# Map tiles (URL-restricted public token)
VITE_MAPBOX_TOKEN=pk.eyJ...

# Error tracking
VITE_SENTRY_DSN=https://...

# Analytics (dev default: console)
VITE_ANALYTICS_BACKEND=console
```

### Server-only secrets (Vercel / preview deploys)

Server routes under `api/` read secrets without the `VITE_` prefix. These are **not** needed for basic local dev unless you are testing a specific integration. Full reference: [Secrets & Integrations](secrets-and-integrations.md).

Common server vars:

| Variable | Used by |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin routes, webhooks, migrations |
| `ANTHROPIC_API_KEY` | AI Concierge |
| `STRIPE_SECRET_KEY` | Ticketing |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify proxy |
| `MAPBOX_SERVER_TOKEN` | Server-side geocoding |

> **Never** prefix secrets with `VITE_` — Vite inlines those into the client bundle.

## 3. Start the dev server

```bash
npm run dev
```

Vite serves the app (default port from Vite config). Open the URL printed in the terminal.

## 4. Local Supabase (optional)

For database-backed development with RLS and migrations:

```bash
# First time: start local Supabase (requires Docker)
supabase start

# Apply all migrations + seed data
supabase db reset
```

Point `.env` at the local instance (printed by `supabase start`):

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key-from-supabase-start>
```

See [Backend Migration](backend-migration.md) for cloud linking, `db push`, and seeding staging.

## 5. Verify your setup

```bash
# Unit tests
npm run test

# Lint
npm run lint

# Production build
npm run build

# Full release gate
npm run release-check
```

### E2E smoke tests

Playwright runs against a preview build:

```bash
npm run build
npm run preview   # in one terminal
npm run test:smoke  # in another
```

CI sets `VITE_E2E_AUTH_BYPASS=true` and clears Supabase env so smoke tests run without credentials.

## 6. Common scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + production bundle |
| `npm run preview` | Serve `dist/` locally |
| `npm run test` | Vitest unit suite (once) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:smoke` | Playwright E2E |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |
| `npm run bundle-size` | Check chunk budgets |
| `npm run release-check` | lint + test + build + audit |
| `npm run cap:sync` | Sync web build to Capacitor |
| `npm run cap:open:ios` | Open Xcode project |
| `npm run cap:open:android` | Open Android Studio |

## 7. Project orientation

| Path | What lives here |
|------|-----------------|
| `src/components/` | React UI — pages, features, Shadcn primitives |
| `src/hooks/` | Custom hooks bridging state and domain logic |
| `src/lib/` | Pure TypeScript — scoring, recommendations, data layer |
| `api/` | Vercel serverless handlers (`/api/*`) |
| `supabase/migrations/` | Ordered SQL migrations |
| `e2e/` | Playwright smoke specs |
| `docs/` | Documentation (you are here) |

Read [ARCHITECTURE.md](../ARCHITECTURE.md) for data flow, scoring algorithm, and state management. Read [CONTRIBUTING.md](../CONTRIBUTING.md) for branch strategy, code style, and PR expectations.

## 8. Native apps (optional)

Pulse ships as a Capacitor wrapper for iOS and Android. See [Native Setup](native/setup.md) for Xcode/Android Studio configuration, push notifications, and app signing.

## Troubleshooting

### App loads but data doesn't persist

You are likely on mock data. Add Supabase env vars or check `VITE_USE_SUPABASE_BACKEND` is not set to `false`.

### Map tiles are blank

Set `VITE_MAPBOX_TOKEN` to a valid Mapbox public token with URL restrictions for your dev origin.

### API routes return 404 locally

Vercel serverless routes (`api/`) are proxied in production via `vercel.json`. For local API testing, use `vercel dev` or deploy a preview. The Vite dev server alone does not serve `/api/*`.

### Supabase auth errors

Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match the same project. For server routes, also set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or rely on the `VITE_` fallbacks documented in `api/_lib/auth.ts`).

### Tests fail after env changes

Vitest caches env at module load. Restart the test runner after changing `.env`.

## Next steps

- [Feature Flags](feature-flags.md) — enable ticketing, concierge, video feed, etc.
- [API Reference](api-reference.md) — server route catalog
- [RELEASE_CHECKS.md](../RELEASE_CHECKS.md) — pre-deploy checklist
