# Data Layer

Pulse supports two data backends: **local mock fixtures** (prototype default) and **Supabase** (production target). The active backend is resolved at module load from environment variables.

**Source of truth:** `src/lib/data/config.ts`, `src/lib/data/index.ts`

## How the toggle works

```
┌─────────────────────────────────────────────────────────┐
│              resolveBackend() decision tree              │
├─────────────────────────────────────────────────────────┤
│  1. Missing/placeholder Supabase creds?  → MOCK       │
│  2. VITE_USE_SUPABASE_BACKEND=false?       → MOCK       │
│  3. Otherwise                              → SUPABASE   │
└─────────────────────────────────────────────────────────┘
```

### Environment variables

| Variable | Effect |
|----------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL (required for backend) |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (required for backend) |
| `VITE_USE_SUPABASE_BACKEND` | Explicit override: `true`/`false`/`1`/`0` |

Placeholder values (e.g. `placeholder-project.supabase.co`) are treated as unconfigured and force mock mode.

### Exported constant

```typescript
import { USE_SUPABASE_BACKEND } from '@/lib/data'

// true  → reads/writes go through Supabase adapters
// false → reads/writes use src/lib/mock-data.ts fixtures
```

In dev, when mock mode is active, a one-time console info line explains the state.

## Module layout (`src/lib/data/`)

| Module | Responsibility |
|--------|----------------|
| `config.ts` | Backend resolution, `hasSupabaseEnv()`, dev warnings |
| `index.ts` | Re-exports domain adapters |
| `venues.ts` | Venue catalog reads |
| `events.ts` | Event listings |
| `notifications.ts` | In-app notification feed |
| `concierge.ts` | Concierge session persistence |
| `video-pulses.ts` | Video pulse metadata |
| `venue-staff.ts` | Staff role lookups |

Each adapter follows the same pattern: if `USE_SUPABASE_BACKEND`, call Supabase client queries; otherwise return or mutate mock fixtures.

## Mock backend (prototype)

**Seed data:** `src/lib/mock-data.ts` — ~20 US venues, sample users, pulses, notifications.

**Persistence:** Spark KV hooks (`@github/spark`) hold app state in browser storage. Data survives page reloads but not cross-device.

**When to use:**

- Local dev without Supabase credentials
- UI/component work that doesn't need real persistence
- CI smoke tests (Playwright clears Supabase env)

## Supabase backend (production target)

**Schema:** `supabase/migrations/` — ordered SQL with RLS policies, realtime publications, and feature tables (ticketing, safety, video, creator economy).

**Auth:** `src/hooks/use-supabase-auth.tsx` manages sign-in and auto-creates a `profiles` row on first login.

**Client:** `src/lib/supabase.ts` — typed Supabase JS client.

**Server:** `api/_lib/supabase-server.ts` — user-scoped clients (JWT forwarded) and service-role clients (webhooks, cron).

**RLS:** Row-level security is the authorization boundary. Server routes pass the caller's JWT so policies enforce identity. See [Backend Migration](backend-migration.md) for policy inventory.

## State architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Current (prototype)                   │
│  Spark KV ──► optimistic UI ──► mock adapters (fallback) │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                     Target (production)                   │
│  TanStack Query ◄──► Supabase ◄──► RLS policies          │
│  Spark KV / localStorage ──► preferences + offline cache │
└──────────────────────────────────────────────────────────┘
```

Migration is incremental: individual call sites in `src/lib/data/*` can flip to Supabase without rewriting the entire app shell.

## Server API vs direct Supabase

Two server paths coexist:

| Path | When used |
|------|-----------|
| Direct Supabase (client) | Reads/writes where RLS is sufficient |
| `/api/*` routes | Moderation, rate limits, Stripe, Twilio, third-party proxies |

New write paths with business logic (pulse creation, ticketing) should go through `api/` handlers. Simple reads can use Supabase client + RLS.

## Offline behavior

`src/lib/offline-queue.ts` queues writes when the network is unavailable. On reconnect, queued actions replay. The queue targets API endpoints where available, falling back to local state for prototype flows.

## Testing

`src/lib/__tests__/data-toggle.test.ts` verifies backend resolution across env combinations.

To force mock mode in tests:

```typescript
vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
```

To force Supabase mode:

```typescript
vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefgh.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'real-looking-key')
vi.stubEnv('VITE_USE_SUPABASE_BACKEND', 'true')
```

## Rollout checklist

1. Apply migrations: `supabase db push --linked` ([Backend Migration](backend-migration.md))
2. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel
3. Seed staging: `psql "$SUPABASE_DB_URL" -f supabase/seed.sql`
4. Verify auth flow (sign-up, profile creation)
5. Smoke test pulse create via `/api/pulses/create`
6. Monitor RLS denials in Supabase logs
7. Gradually retire mock-only code paths

## Related docs

- [Getting Started](getting-started.md) — local Supabase setup
- [Backend Migration](backend-migration.md) — migrations, seeding, admin access
- [API Reference](api-reference.md) — server routes
- [PRODUCTION_DATA_PATH](PRODUCTION_DATA_PATH.md) — end-to-end production data flow
