# Supabase Persistence Cutover — Go-Live Checklist

The venue app's core-loop data layer is **already Supabase-capable in code**:
venue read, pulse read/write, reactions, check-ins, auth, and realtime all have
real implementations that activate the moment valid credentials are present.
This doc is the operator checklist to take it live, plus the known remaining
code gaps.

## How the app decides mock vs. Supabase

At runtime the app is backed by Supabase iff **both** `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are set to real (non-placeholder) values and
`VITE_USE_SUPABASE_BACKEND` is not `false`. Otherwise it runs on bundled mock
fixtures. See `src/lib/data/config.ts` (`USE_SUPABASE_BACKEND`,
`hasSupabaseEnv()`) and `src/lib/supabase.ts` (`hasSupabaseConfig`,
`hasPlaceholderCredentials()`).

## Operator steps (only you can do these)

1. **Create a Supabase project** (supabase.com) for the target environment
   (staging first, then production).
2. **Run the migrations** in `supabase/migrations/` against it, in order:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   These create `venues`, `pulses`, `reactions`, `pulse_reactions`,
   `check_ins`, `profiles`, `notifications`, `presence`, live-report tables,
   and the RLS policies (authenticated `*_insert_self` on pulses / reactions /
   check-ins).
3. **Seed venues** for the launch market. The app reads real rows from
   `venues`; with an empty table the discovery feed is empty. Seed from
   `supabase/seed.sql` or an import of the launch-district venues.
4. **Set env vars** in the deploy target (Vercel → Project → Settings → Env):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (from the project's API
     settings)
   - leave `VITE_APP_MODE` unset (defaults to `venue`) or set `venue`
   - do **not** set `VITE_VISUAL_PREVIEW` or `VITE_E2E_AUTH_BYPASS` in prod —
     both force the mock/bypass path.
5. **Configure auth providers** in Supabase (Google/Apple OAuth and/or magic
   link) to match `use-supabase-auth.tsx` (`signInWithOAuth`, `signInWithOtp`,
   `signInAnonymously`).
6. **Deploy geocode edge function** (`supabase/functions/geocode`) and any
   other functions, so client geocoding stops calling Nominatim directly.
7. **Smoke test on staging**: sign in, post a pulse, confirm it lands in the
   `pulses` table, appears via realtime on a second device, and that the venue
   score updates.

## Offline resilience (now wired — 2026-07)

Pulses created while offline (or when an upload fails) are persisted to a
localStorage queue and replayed to Supabase automatically on reconnect:

- Enqueue on failure: `src/hooks/use-app-handlers.ts` (`handleSubmitPulse`).
- Drain on mount / `online` event: `src/hooks/use-pulse-sync.ts` (`usePulseSync`,
  mounted in `AppBootstrap`), using `processQueue` from `src/lib/offline-queue.ts`.
- Only active when `USE_SUPABASE_BACKEND` is true.

## Known remaining code gaps (follow-up PRs)

These are non-blocking for a credentialed launch but should be cleaned up:

1. **`venues_within_miles` RPC missing.** `src/lib/data/venues.ts#listNearby`
   calls a PostGIS RPC that no migration defines, so it always falls back to a
   naive client-side distance filter. Add the RPC (or accept the fallback).
2. **Two divergent reaction models.** Production writes reactions via the
   `toggle_pulse_reaction` RPC (`pulse_reactions` table / `pulses.reactions`
   JSONB). The normalized `reactions` table + `src/lib/data/reactions.ts`
   module are unused. Pick one and delete the other.
3. **Unused clean mutation scaffolding.** `useCreatePulse` /
   `PulseData.createPulse` (`src/hooks/api/use-pulses.ts`, `src/lib/data/pulses.ts`)
   duplicate the active `uploadPulseToSupabase` path and are not consumed.
   Either migrate the write path onto them or remove them.
4. **Pulse resync idempotency.** `uploadPulseToSupabase` uses `.insert()`; a
   primary-key conflict on replay (partial prior success) fails and relies on
   the retry cap to eventually drop the item. Consider an upsert with
   `onConflict: 'id', ignoreDuplicates: true` for clean idempotent replay.

## References

- [PRODUCTION_ROLLOUT.md](../PRODUCTION_ROLLOUT.md) — full rollout phases
- [COMMERCIAL_ROADMAP.md](../COMMERCIAL_ROADMAP.md) — Phase A depends on this cutover
- [docs/database-schema.md](database-schema.md) — table/RLS reference
