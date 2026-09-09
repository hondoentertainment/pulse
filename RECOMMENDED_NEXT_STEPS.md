# Pulse — Recommended Next Steps

> Updated 2026-09-09. Pulse is venue + map only. The former Pulse Signal check-in product was removed (no `VITE_APP_MODE`). Human ops remain: venue migrations/env (#64), branch protection (#65).

## Decision

**Pulse is the nightlife venue + map PWA.** Optional geo-gate: `VITE_LAUNCHED_CITIES=Seattle,WA`. See [PRD.md](PRD.md). Signal was removed rather than left behind a flag.

## Still required in production (human ops)

These cannot be completed from this agent (no Supabase admin, no Vercel token, no GitHub admin on `main`). Tracked as #64, #65.

1. **OPS-1 / OPS-2** (#64) Apply venue / Seattle launch migrations in the production Supabase project:
   - `20260825000000_venue_signal_seattle_launch.sql` (and earlier venue schema as needed)
   - Leftover Signal tables from `20260816000000_signal_core.sql` / `_pilot_signups` / `_push_subscriptions` may already exist. They are unused by the app; do not drop them without a dedicated review.
2. **OPS-1 env** Set production (and rebuild):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (legacy alias `SUPABASE_SERVICE_ROLE`)
   - `CRON_SECRET` (wait-time + safety crons)
   - Do **not** set `VITE_APP_MODE` — the variable is gone
3. **HOUSE-1 remainder** (#65) GitHub → Settings → Branches → `main`:
   - Required check `smoke-preview` aliases `smoke-preview-venue`. Remove retired `smoke-preview-signal` / `e2e-signal` required checks if they are still listed.
   - Solo maintainer: allow admin bypass **or** set required reviews to 0 — the owner cannot approve their own PR

## Historical — Signal (removed)

The following shipped in-repo for Pulse Signal and was deleted with the product: check-in windows, trends, CSV/JSON export, reminders, pilot signup, and `signal_*` analytics. Do not restore a dual-mode flag.

## Parked

- Apple Health / Google Fit
- AI concierge, ticketing, creator economy, video feed
- Invented Pulse Pro pricing or Stripe
- Restoring Pulse Signal or a Signal-default flip
