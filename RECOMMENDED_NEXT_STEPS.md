# Pulse — Recommended Next Steps

> Updated 2026-09-03 after the Signal insight cycle (post-#70). The 2026-09-01 cycle notes are kept below.

## Decision

**Pulse Signal is the default product** (`VITE_APP_MODE=signal`). Venue discovery remains in-repo behind `VITE_APP_MODE=venue` and optional `VITE_LAUNCHED_CITIES=Seattle,WA`. See [PRD_SIGNAL.md](PRD_SIGNAL.md). Do not merge another default-mode flip.

## Feature roadmap

### Implemented — 2026-09-03 insight cycle

Five additive Signal features. Each is pure `src/lib/signal-*.ts` logic with unit tests, one card or control in `SignalApp.tsx`, and an analytics event. No new dependencies, no migrations, no server changes.

| Feature | Module | Surface | Gate |
|---|---|---|---|
| Sleep → next-day link | `signal-sleep-link.ts` | Trends card | ≥1 consecutive-day pair; full read at 5 |
| Streak milestones 3 / 7 / 14 / 30 / 100 | `signal-milestones.ts` | Home banner + streak-tile nudge | fires once per milestone (`lastCelebratedMilestone` in the local store) |
| Personal records + best weekday | `signal-records.ts` | Trends card | ≥7 check-ins; a weekday needs ≥2 |
| History filter by window and tag | `signal-filter.ts` | History chips | any entries |
| Monthly summary vs last month | `signal-patterns.ts` (`buildMonthlySummary`) | Trends card | ≥2 days; full read at 5 |

Why these five: each closes a loop the PRD already promises (keep the streak, patterns you can act on, own your data) without inventing product surface. Sleep is paired with the *following* day on purpose: the score already weights sleep quality, so a same-day comparison would be circular.

### Proposed next (not started)

Ordered by fit with the core loop. None needs a migration unless noted.

1. **CSV import** — invert `entriesToCsv`; needs a new store action plus one `saveSignalEntry` per row (the 23505 conflict path already exists). Completes the own-your-data story.
2. **JSON export** — ~30 lines on `signal-export.ts`; ship together with import.
3. **Unusual-week flag** — trailing 7 days against the prior 21-day baseline. Only honest after ~4 weeks of data; ship gated with a keep-logging fallback.
4. **Month calendar view** — CSS grid coloured by `scoreBucketColor`. Presentation rather than insight, so it sits below the three above.
5. **Local reminder snooze** — client-side `snoozedUntil`. Closed-app quiet hours would need a `signal_profiles` column (migration) and cron changes; call that out before starting.

Rejected this cycle: per-entry notes (needs a DB column and contradicts the "no typing" promise), and everything under Parked.

## Implemented — 2026-09-01 cycle (in-repo)

| Item | Status |
|------|--------|
| ESM relative specifiers across `api/` | Done — `.js` on handlers + `_lib` (do not regress `reminders/dispatch`) |
| Signal flow tests (check-in windows, Today is logged, trends, CSV, delete, pilot) | Done |
| Signal first-paint: persist + Spark off the default entry | Done — `QueryClientProvider` only; Spark is `import.meta.env.DEV`; venue persist stays in `AppProviders` |
| Lint unused imports/vars trimmed | Done — errors still 0; do not raise `--max-warnings` |
| DOCS-1 README matches shipping Signal | Done (prior cycle) |
| HOUSE-1 `smoke-preview` CI alias | Done (prior cycle) |
| OPTIONAL-A CSV, weekly summary, tag patterns, delete | Done (prior cycle + tests this cycle) |
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
- Per-entry notes (needs a `signal_entries` column; contradicts "no typing")

#42 / #44 / #55 / #60 stay superseded. #48–#53 shipped flag-gated in #62 and stay off the default path.
