# Deployment Guide (Vercel)

How Pulse is built, deployed, and operated on Vercel. Covers preview and production environments, environment variables, serverless API routes, cron jobs, and rollback.

---

## Architecture on Vercel

```
GitHub push / manual dispatch
        │
        ▼
┌───────────────────┐     ┌─────────────────────────────┐
│  GitHub Actions   │     │  Vercel (connected repo)    │
│  CI on every PR   │     │  Auto-deploy on push        │
│  Deploy workflow  │────▶│  Preview (branches/PRs)     │
│  (manual)         │     │  Production (main)          │
└───────────────────┘     └──────────────┬──────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              Static SPA            /api/* Functions      Cron jobs
              (dist/)              (serverless)         (vercel.json)
```

| Layer | Source | Output |
|-------|--------|--------|
| **Frontend** | `npm run build` (Vite) | `dist/` static assets |
| **API routes** | `api/**/*.ts` | Vercel Serverless Functions |
| **Cron** | `vercel.json` crons | Scheduled function invocations |
| **Database** | Supabase (external) | PostgreSQL + Auth + Realtime |

---

## Prerequisites

- Vercel account with project linked to this GitHub repo
- Supabase project (staging + production)
- GitHub secrets for manual deploy workflow:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

---

## Initial project setup

### 1. Connect the repository

1. [Vercel Dashboard](https://vercel.com) → **Add New Project** → Import Git Repository
2. Framework preset: **Vite** (auto-detected)
3. Build settings (should match defaults):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
4. Set **Production Branch** to `main`

### 2. Configure `vercel.json`

The repo root `vercel.json` configures:

- **Security headers** — X-Frame-Options, CSP-adjacent policies, Permissions-Policy
- **SPA rewrites** — all non-API paths → `index.html`
- **API rewrites** — `/api/*` → serverless functions
- **Cron jobs** — wait-time recompute (10 min), safety session expiry (1 min)

No changes needed for standard deploys.

### 3. Environment variables

Set in Vercel → Project → Settings → Environment Variables. Use separate values for **Production**, **Preview**, and **Development**.

#### Required for Supabase backend

| Variable | Scope | Environment |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | Client + server | All |
| `VITE_SUPABASE_ANON_KEY` | Client + server | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Production, Preview |

#### Recommended for production

| Variable | Scope | Notes |
|----------|-------|-------|
| `VITE_SENTRY_DSN` | Client | Error tracking |
| `VITE_MAPBOX_TOKEN` | Client | Map tiles (URL-restricted) |
| `MAPBOX_SERVER_TOKEN` | Server | Geocoding |
| `SUPABASE_ADMIN_EMAILS` | Server | Comma-separated admin allowlist |

#### Feature-specific (enable as ready)

See [Feature Flags](feature-flags.md) and [Secrets & Integrations](secrets-and-integrations.md) for the full list:

- `VITE_TICKETING_ENABLED` + Stripe keys
- `VITE_AI_CONCIERGE_ENABLED` + `ANTHROPIC_API_KEY`
- `VITE_SAFETY_KIT_ENABLED` + Twilio keys
- `VITE_CREATOR_ECONOMY_ENABLED`
- `VITE_VIDEO_FEED_ENABLED`

> **Rule:** Never prefix secrets with `VITE_`. Only public keys and feature flags use the `VITE_` prefix.

### 4. Link Supabase

Before first production deploy with real data:

```bash
supabase link --project-ref <ref>
supabase db push --linked
```

See [Backend Migration](backend-migration.md) for migration and seeding steps.

---

## Deployment methods

### Automatic (recommended)

Vercel deploys automatically when connected to GitHub:

| Trigger | Target | URL |
|---------|--------|-----|
| Push to `main` | Production | `https://<project>.vercel.app` |
| Push to feature branch | Preview | `https://<branch>-<project>.vercel.app` |
| Pull request | Preview | Unique preview URL per PR |

### Manual via GitHub Actions

The `deploy.yml` workflow supports controlled deploys:

```bash
# GitHub → Actions → Deploy → Run workflow
# Choose: preview or production
```

Steps:
1. **quality_gate** — build + Playwright smoke tests
2. **deploy_preview** — `vercel pull` → `vercel build` → `vercel deploy --prebuilt`
3. **deploy_production** — same with `--prod` (only when `target=production`)

### Manual via Vercel CLI

```bash
# Link project (one time)
npx vercel link

# Pull env for target environment
npx vercel pull --yes --environment=preview

# Build locally with Vercel env
npx vercel build

# Deploy prebuilt output
npx vercel deploy --prebuilt

# Production (use with care)
npx vercel pull --yes --environment=production
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

### Local API development

The Vite dev server does not serve `/api/*`. To test server routes locally:

```bash
npx vercel dev
```

This runs both the Vite frontend and serverless functions with local env.

---

## Pre-deploy checklist

Run before every production promotion:

```bash
npm run release-check   # lint + test + build + audit
npm run test:smoke      # Playwright smoke (against preview)
```

Full manual checklist: [RELEASE_CHECKS.md](../RELEASE_CHECKS.md).

### CI gates (every PR)

Enforced by `.github/workflows/ci.yml`:

| Gate | Command |
|------|---------|
| Lint | `npm run lint` |
| Unit tests | `npm run test` |
| Build | `npm run build` |
| Smoke tests | `npm run test:smoke` |
| Dependency audit | `npm audit --audit-level=high` |

Details: [CI Gates](ci-gates.md).

---

## Environments

| Environment | Branch | Supabase | Feature flags |
|-------------|--------|----------|---------------|
| **Development** | local | Local Docker or dev project | All on for testing |
| **Preview** | PR branches | Staging project | Match staging config |
| **Production** | `main` | Production project | Gradual rollout |

### Promoting preview → production

1. Verify preview URL passes [RELEASE_CHECKS.md](../RELEASE_CHECKS.md) manual smoke
2. Confirm env vars are set for Production in Vercel
3. Merge PR to `main` (auto-deploys) or run Deploy workflow with `target=production`
4. Monitor Sentry and Supabase logs for 15 minutes post-deploy

---

## Serverless functions

All routes in `api/` deploy as Vercel Functions. Key behaviors:

| Concern | Implementation |
|---------|----------------|
| Auth | `api/_lib/auth.ts` — JWT verification, admin allowlist |
| Rate limiting | `api/_lib/rate-limit.ts` — per-user/IP |
| CORS | Same-origin in production; `handlePreflight` in handlers |
| Cron auth | Cron routes should verify `CRON_SECRET` or Vercel cron headers |

Route catalog: [API Reference](api-reference.md).

### Cron jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/wait-time/recompute` | Every 10 min | Refresh wait-time estimates |
| `/api/safety/cron/check-expired` | Every 1 min | Expire stale safety sessions |

Cron routes use the Supabase service role key for privileged writes.

---

## Rollback

### Instant rollback (Vercel)

1. Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click **⋯** → **Promote to Production**

No rebuild required. Previous deployment becomes live immediately.

### Bad deploy runbook

Full procedure: [runbooks/bad-deploy.md](runbooks/bad-deploy.md).

Quick steps:
1. Promote previous deployment in Vercel
2. If schema migration caused issues, write a reverse migration (never edit historical migrations)
3. Post incident summary per [Incident Response](incident-response.md)

### Read-only mode

During Supabase outages, set:

```env
VITE_PULSE_READ_ONLY_MODE=true
```

Client disables writes. See [runbooks/supabase-outage.md](runbooks/supabase-outage.md).

---

## Monitoring post-deploy

| Signal | Where |
|--------|-------|
| Client errors | Sentry (`VITE_SENTRY_DSN`) |
| Web vitals | Vercel Speed Insights |
| Page views | Vercel Analytics |
| Server logs | Vercel → Functions → Logs |
| DB errors | Supabase → Logs |
| Uptime | Configure external ping on `/` |

Observability setup: [Observability](observability.md).

---

## Troubleshooting

### 404 on direct URL or refresh

`vercel.json` must include the SPA rewrite. Confirm:

```json
{ "source": "/(.*)", "destination": "/index.html" }
```

API routes are excluded by ordering — `/api/*` rewrite comes first.

### Build fails on Vercel

- Check Node version: Vercel Settings → General → Node.js 20
- Run `npm run build` locally to reproduce
- Check for missing env vars that break build-time `import.meta.env` access

### API routes return 500

- Vercel → Functions → select route → view logs
- Common causes: missing `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, Stripe keys
- Verify server env vars are set for the correct environment (Preview vs Production)

### Env var not available in client

Vite only exposes `VITE_*` prefixed variables. Redeploy after adding env vars — they are baked in at build time.

### Cron not firing

- Confirm `vercel.json` crons section is deployed
- Cron jobs only run on **Production** deployments
- Check function logs for the cron path

---

## Related docs

- [Getting Started](getting-started.md) — local dev setup
- [Secrets & Integrations](secrets-and-integrations.md) — all env vars
- [Backend Migration](backend-migration.md) — database setup
- [RELEASE_CHECKS.md](../RELEASE_CHECKS.md) — pre-deploy checklist
- [PRODUCTION_ROLLOUT.md](../PRODUCTION_ROLLOUT.md) — phased launch plan
- [runbooks/bad-deploy.md](runbooks/bad-deploy.md) — rollback procedure
