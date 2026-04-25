# Backend Migration Runbook

Short reference for standing up Supabase as the authoritative backend,
applying the new schema + RLS migrations, and gradually flipping call
sites off mock data.

## 1. Prerequisites

- Supabase CLI `>= 1.170` (`brew install supabase/tap/supabase`).
- A Supabase project with **PostGIS** extension enabled
  (Database > Extensions > search `postgis` > enable). The initial schema
  migration will also `CREATE EXTENSION IF NOT EXISTS postgis` for local.
- `.env` populated with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  and for migration tooling: `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  See `.env.example`.

## 2. Applying migrations

The `supabase/migrations/` directory is ordered by timestamp. Migrations
are idempotent: re-running against an existing DB is safe.

### Local dev (Docker)

```bash
supabase start                 # first time only
supabase db reset              # applies all migrations + seed.sql
```

### Staging / prod

```bash
# One-off: link the local checkout to the cloud project
supabase link --project-ref <ref>

# Dry run: print the SQL that would be applied
supabase db diff --linked

# Apply pending migrations
supabase db push --linked
```

**Rollback strategy:** migrations are additive. Rolling back a specific
change means writing a new migration that reverses it. Do **not** edit
historical migrations once they're in staging/prod.

### Migration inventory (as of this PR)

| File | Purpose |
|------|---------|
| `20260322000000_initial_schema.sql` | profiles, venues, pulses, notifications |
| `20260329000001_add_missing_tables_and_columns.sql` | presence, events, extra columns |
| `20260329000002_rls_policies.sql` | initial (permissive) RLS for presence/events |
| `20260329000003_realtime.sql` | Publication for realtime channels |
| `20260417000001_core_tables_and_soft_delete.sql` | **new** reactions/check_ins/follows + soft-delete + updated_at |
| `20260417000002_rls_policies_enforcement.sql` | **new** full RLS policy set + admin bypass |

## 3. Seeding data

`supabase/seed.sql` inserts ~20 representative venues with deterministic
UUIDs. `supabase db reset` runs seed automatically on local.

For staging, run once after first migration:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

**Profiles** are not seeded — they are auto-created on first sign-in by
`src/hooks/use-supabase-auth.tsx` (`ensureProfile`). To seed a test user:

```sql
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000001', 'test@example.com');

insert into profiles (id, username)
values ('00000000-0000-4000-8000-000000000001', 'testuser');
```

## 4. Admin access (RLS bypass)

Policies check `is_admin()`, which reads `app_metadata.role = 'admin'`
from the caller's JWT. To promote a user:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'admin')
where email = 'owner@pulse.app';
```

The user must sign out and back in to pick up the refreshed claims.
Alternatively, cloud edge functions can mint JWTs server-side via the
`supabase.auth.admin.updateUserById` API.

## 5. Flipping the app off mock data

Mock sources live in:

- `src/lib/mock-data.ts`
- `src/lib/global-venues.ts`
- `src/lib/us-venues.ts`

The new data layer at `src/lib/data/` wraps Supabase queries with the same
shape (`Venue`, `Pulse`, etc.). Strategy:

1. Pick a surface (e.g. `DiscoverTab`). Replace its mock-data imports with
   `VenueData.listNearby(...)` calls wrapped in TanStack Query.
2. Keep the mock-data imports as a fallback when
   `hasPlaceholderCredentials()` returns `true` so local dev without a
   Supabase project still works.
3. Gate behind a feature flag (`VITE_FF_BACKEND_VENUES` etc.) so staging
   can toggle without a deploy.
4. Remove mock imports once every consumer of the surface is migrated.

Writes **must** go through the new modules — they enforce `requireAuth`
and surface RLS errors as `AuthRequiredError` / `RlsDeniedError`.

## 6. Promotion to prod

Checklist before flipping production to the real backend:

- [ ] Migrations applied to prod via `supabase db push`.
- [ ] PostGIS enabled (verify `select postgis_version();`).
- [ ] RLS enforced on every user-writable table
      (`select relname from pg_class where relkind='r' and relrowsecurity=false` should list nothing sensitive).
- [ ] `anon` role has no direct INSERT/UPDATE/DELETE grants
      (migration 2 revokes them; re-verify with `\z <table>`).
- [ ] `venues_within_miles` RPC exists (see Appendix) or `listNearby`
      fallback is acceptable.
- [ ] At least one admin user has been promoted.
- [ ] Seed data inserted and spot-checked in the dashboard.
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set in the
      deployment env (Vercel / Cloudflare / etc.).
- [ ] Feature flags flipped one surface at a time with canary monitoring.

## 7. Appendix — optional RPCs

The `listNearby` helper tries an RPC named `venues_within_miles` first.
Suggested definition (add in a follow-up migration when the backend team
is ready to own it):

```sql
create or replace function venues_within_miles(
  lat float, lng float, radius_mi float, max_rows int default 100
)
returns setof venues
language sql
stable
as $$
  select v.*
  from venues v
  where v.deleted_at is null
    and calculate_distance(lat, lng, v.location_lat, v.location_lng) <= radius_mi
  order by calculate_distance(lat, lng, v.location_lat, v.location_lng) asc
  limit max_rows;
$$;
```

## 8. Troubleshooting

| Symptom | Likely cause |
|--------|-------------|
| `permission denied for table X` | RLS policy missing or anon key used for a write. Sign in or add a policy. |
| `new row violates row-level security policy` | WITH CHECK failed — the write's `user_id` doesn't match `auth.uid()`. |
| All queries return `[]` | `deleted_at` filter on rows that were never inserted with an explicit `null`. Backfill: `update X set deleted_at = null where deleted_at is null`. |
| Realtime subscriptions silent | Table not in `supabase_realtime` publication. See migration 20260329000003 + 20260417000001. |
