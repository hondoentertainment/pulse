# Pulse — Recommended Next Steps

> Updated 2026-08-30 after implementing the post-#61 / post-#62 ops queue.

## Decision

**Pulse Signal is the default product** (`VITE_APP_MODE=signal`). Venue discovery remains in-repo behind `VITE_APP_MODE=venue` and optional `VITE_LAUNCHED_CITIES=Seattle,WA`. See [PRD_SIGNAL.md](PRD_SIGNAL.md). Do not merge another default-mode flip.

## Implemented in this cycle (in-repo)

| Item | Status |
|------|--------|
| DOCS-1 README matches shipping Signal | Done |
| HOUSE-1 `smoke-preview` CI alias | Done — wraps `smoke-preview-signal` |
| OPS-1/2 verification + launch runbook | Done in-repo — live migrate still human |
| #57 payload sanitize + SW open `/home` | Done in-repo — live VAPID proof still human |
| OPTIONAL-A CSV, weekly summary, tag patterns, delete | Done |
| OPTIONAL-B Pro interview brief | Done — [docs/pulse-pro-offer-research.md](docs/pulse-pro-offer-research.md) |
| OPTIONAL-C Venue staging runbook | Done — [docs/runbooks/venue-staging.md](docs/runbooks/venue-staging.md) |

## Still required in production (human ops)

These cannot be completed from this agent (no Supabase admin, no Vercel token, no GitHub admin on `main`). Tracked as #64, #65, #66.

1. **OPS-1 / OPS-2** (#64) Apply migrations in the production Supabase project:
   - `20260816000000_signal_core.sql`
   - `20260816000001_signal_pilot_signups.sql`
   - `20260816000002_signal_push_subscriptions.sql`
   - `20260825000000_venue_signal_seattle_launch.sql`
   - Then run [supabase/verify/signal_launch.sql](supabase/verify/signal_launch.sql)
2. **OPS-1 env** Set production (and rebuild):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (legacy alias `SUPABASE_SERVICE_ROLE`)
   - `CRON_SECRET`
   - Optional closed-app push: `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
3. **OPS-2** Prove the live loop on https://pulse-chi-nine.vercel.app/ using [docs/runbooks/signal-launch.md](docs/runbooks/signal-launch.md)
4. **HOUSE-1 remainder** (#65) GitHub → Settings → Branches → `main`:
   - Required check `smoke-preview` now has a job again (alias). Keep it, or switch the required name to `smoke-preview-signal`
   - Solo maintainer: allow admin bypass **or** set required reviews to 0 — the owner cannot approve their own PR
5. **#57 remainder** (#66) Closed-app Web Push on a real device: [docs/runbooks/signal-web-push.md](docs/runbooks/signal-web-push.md)

```bash
SIGNAL_PROD_URL=https://pulse-chi-nine.vercel.app npm run verify:signal-prod
```

## Parked

- Archiving venue code
- Apple Health / Google Fit
- AI concierge, ticketing, creator economy, video feed
- Social comparison inside Signal
- Invented Pulse Pro pricing or Stripe
- Reopening #44 venue default flip

#42 / #44 / #55 / #60 stay superseded. #48–#53 shipped flag-gated in #62 and stay off the default path.
