# Runbook: Pulse Signal launch (migrations, reminders, pilot list)

## Purpose

Apply the Signal-first schema and turn on daily reminders after the #56–#59 implementation lands.

## Preconditions

- Supabase project admin access
- Vercel project admin access
- `supabase` CLI or Dashboard SQL editor
- Production default remains `VITE_APP_MODE=signal`

## Procedure

1. Apply migrations in order:
   - `supabase/migrations/20260816000000_signal_core.sql`
   - `supabase/migrations/20260816000001_signal_pilot_signups.sql`
   - `supabase/migrations/20260816000002_signal_push_subscriptions.sql`
2. Confirm tables exist: `signal_entries`, `signal_profiles`, `signal_pilot_signups`, `signal_push_subscriptions`.
3. Set production env:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (legacy alias: `SUPABASE_SERVICE_ROLE`)
   - `CRON_SECRET`
   - Optional closed-app push: `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, plus existing FCM/APNs vars
4. Redeploy so client `VITE_*` values are baked in.
5. Trigger a dry reminder dispatch:
   ```bash
   curl -sS -H "Authorization: Bearer $CRON_SECRET" \
     "$PROD_URL/api/signal/reminders/dispatch"
   ```
   Expect `{ "data": { "candidates": <n>, "results": [...] } }`.
6. Submit one Settings → Pulse Pro pilot email and confirm a row in `signal_pilot_signups`.

## Verification

- [ ] Authenticated check-in writes `check_in_window` + `day_key`
- [ ] Second save in the same window is refused (Home shows “Today is logged”)
- [ ] Evening window opens after noon when morning is already logged
- [ ] Duplicate pilot email returns “already on the list”, not a false success
- [ ] Reminder cron skips users whose `day_key` is already logged
- [ ] Settings reminder copy stays honest when VAPID/permission is missing

## Rollback / Escalation

- App rollback does not drop tables. Leave migrations in place.
- To stop reminder fan-out: remove the cron path in `vercel.json` or unset `CRON_SECRET` and block the route at the firewall.
- To stop pilot writes: remove `/api/signal/pilot` or drop the service-role env so the handler returns 500 (client shows a hard failure).
- Escalate if RLS blocks owner reads/writes on `signal_entries` after migrate.

## Ownership

- Owner: Signal product engineer
- Last reviewed: 2026-08-16
