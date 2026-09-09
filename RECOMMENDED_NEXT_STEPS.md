# Pulse — Recommended Next Steps

> Updated 2026-09-09 after intake triage (post-#71 on `main`). Open GitHub work: #64, #65, #66 only.

## Intake Summary

- Total active items: **8** (3 human-ops blockers + 5 agent-executable Signal features)
- Recommended next action: **OPS-1 / #64** — apply production Supabase migrations + env, then prove the live loop
- Why: Feature code on `main` cannot retain check-ins, run reminders, or sync across devices until prod schema/env are real. Code work without that is polish on a prototype persistence path.

## Prioritized Queue

### Track A — Human ops (do first; agents cannot finish these)

1. **[OPS-1] Apply Signal migrations + env in production** — Priority: P0 | Effort: S–M | Impact: Stability / data
   - Issue: #64
   - Why now: Blocks signed-in persistence, reminder cron, pilot signups, and multi-device sync
   - Dependencies: Supabase admin + Vercel env access
   - Acceptance criteria:
     - [ ] Migrations applied in order (`signal_core` → `pilot_signups` → `push_subscriptions` → `venue_signal_seattle_launch`)
     - [ ] `supabase/verify/signal_launch.sql` shows all `signal_*` tables present
     - [ ] Prod env set: `VITE_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (+ optional VAPID)
     - [ ] Redeploy so client `VITE_*` values are baked in
   - Verification: [docs/runbooks/signal-launch.md](docs/runbooks/signal-launch.md) + `SIGNAL_PROD_URL=https://pulse-chi-nine.vercel.app npm run verify:signal-prod`

2. **[OPS-2] Prove the live Signal loop on production** — Priority: P0 | Effort: S | Impact: User-facing
   - Issue: #64 (remainder)
   - Why now: Confirms migrations/env actually work end-to-end
   - Dependencies: OPS-1 complete
   - Acceptance criteria:
     - [ ] Auth check-in writes `day_key` + `check_in_window`
     - [ ] Same-window double save refused; evening after noon when morning logged
     - [ ] Device A save visible on Device B after refresh
     - [ ] Reminder dispatch returns candidates/results with valid `CRON_SECRET`
     - [ ] Pilot email idempotent; CSV export + delete-my-data work for the signed-in account
   - Verification: Checklist in [docs/runbooks/signal-launch.md](docs/runbooks/signal-launch.md)

3. **[HOUSE-1] Branch protection for solo maintainer** — Priority: P1 | Effort: S | Impact: Developer velocity
   - Issue: #65
   - Why now: Required checks exist; owner cannot merge own PRs without bypass or zero required reviews
   - Dependencies: None (can run in parallel with OPS-1)
   - Acceptance criteria:
     - [ ] `main` requires `smoke-preview` (or rename required check to `smoke-preview-signal`)
     - [ ] Solo maintainer can merge (admin bypass **or** required reviews = 0)
   - Verification: Open a no-op PR and confirm checks + merge path work

4. **[OPS-3] Closed-app Web Push on a real device** — Priority: P1 | Effort: M | Impact: Retention
   - Issue: #66
   - Why now: Completes the reminder loop the PRD promises; only honest after VAPID + migrations
   - Dependencies: OPS-1 env includes VAPID keys; OPS-2 live loop green
   - Acceptance criteria:
     - [ ] Subscribe succeeds on a real phone/desktop with permission granted
     - [ ] Cron delivers a closed-app push when today is unlogged
     - [ ] Settings copy stays honest when permission/VAPID missing
   - Verification: [docs/runbooks/signal-web-push.md](docs/runbooks/signal-web-push.md)

### Track B — Agent-executable product (after or between ops waits)

5. **[FEAT-1] CSV import + JSON export** — Priority: P2 | Effort: M | Impact: Trust / own-your-data
   - Why now: Export already ships (`entriesToCsv`); import inverts it and completes the data story. JSON export is ~30 lines on `signal-export.ts` — ship together.
   - Dependencies: None for local/store path; prod import needs OPS-1 for remote `saveSignalEntry` (23505 conflict path already exists)
   - Scope in: parse CSV → store action → one `saveSignalEntry` per row; download JSON mirror of export
   - Scope out: Apple Health / Google Fit; schema changes; per-entry free-text notes
   - Acceptance criteria:
     - [ ] Valid Signal CSV re-imports without duplicating same `(day_key, window)` rows
     - [ ] Malformed rows are skipped with a clear count
     - [ ] JSON export downloads and round-trips fields used by CSV
     - [ ] Unit tests for parse + conflict behavior; Signal smoke still green
   - Verification: `npm test` + `npm run test:smoke:signal`

6. **[FEAT-2] Unusual-week flag** — Priority: P2 | Effort: S | Impact: Insight loop
   - Why now: Closes the “patterns you can act on” promise once users have ~4 weeks of data
   - Dependencies: Prefer ≥28 days of entries; gate UI with keep-logging fallback when baseline is thin
   - Acceptance criteria:
     - [ ] Trailing 7 days compared to prior 21-day baseline
     - [ ] Card hidden or shows keep-logging copy below threshold
     - [ ] Pure `src/lib/signal-*.ts` + unit tests + one Trends surface + analytics event
   - Verification: Unit tests for gated / ungated paths

7. **[FEAT-3] Month calendar view** — Priority: P3 | Effort: S | Impact: Presentation
   - Why now: Useful after insights; lower value than import/unusual-week
   - Dependencies: None
   - Acceptance criteria:
     - [ ] CSS grid coloured by `scoreBucketColor`
     - [ ] No new dependencies; History or Trends host only
   - Verification: Component/unit coverage for empty vs filled months

8. **[FEAT-4] Local reminder snooze** — Priority: P3 | Effort: S (client) / M (closed-app)
   - Why now: Nice retention polish; closed-app quiet hours need a migration — call that out before starting
   - Dependencies: Client-only `snoozedUntil` needs no migration; server quiet hours need `signal_profiles` column + cron changes
   - Acceptance criteria (client-only slice):
     - [ ] Local nudge respects `snoozedUntil`
     - [ ] Settings control to clear snooze
   - Verification: Unit tests for schedule math; no false closed-app claims in copy

## Decision

**Pulse Signal is the default product** (`VITE_APP_MODE=signal`). Venue discovery remains in-repo behind `VITE_APP_MODE=venue` and optional `VITE_LAUNCHED_CITIES=Seattle,WA`. See [PRD_SIGNAL.md](PRD_SIGNAL.md). Do not merge another default-mode flip.

## Feature roadmap

### Implemented — 2026-09-03 insight cycle (#71)

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

Matches Track B above. Ordered by fit with the core loop. None needs a migration unless noted.

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
- Venue Phase 2–6 polish from [NEXT_PHASES.md](NEXT_PHASES.md) (map/onboarding/pulse-creation E2E, mock-data decoupling) — stay behind `VITE_APP_MODE=venue`

## Assumptions

- No open production incident; reliability work is ops setup, not hotfix.
- Solo maintainer still owns Supabase / Vercel / GitHub admin.
- Signal remains the only shipping surface; venue work stays parked.

#42 / #44 / #55 / #60 stay superseded. #48–#53 shipped flag-gated in #62 and stay off the default path.
