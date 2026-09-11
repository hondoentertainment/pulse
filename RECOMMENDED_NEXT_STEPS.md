# Pulse — Recommended Next Steps

> Updated 2026-09-10. Pulse is **venue + map only**. Signal is gone (no `VITE_APP_MODE`).
> Shipped in-repo: full venue schema, 33 curated + 500 OSM = **533** Seattle venues,
> live reviews, map realtime, Figma-matched UI, and map first-paint perf.

## Next-steps PR (#84–#87 + soon stack)

In-repo follow-through lives in [docs/next-steps.md](docs/next-steps.md) and [docs/runbooks/venue-claims-ops.md](docs/runbooks/venue-claims-ops.md). Optional SQL: `supabase/migrations/20260911000000_owner_report_triage.sql`.

## Decision

**Pulse is the nightlife venue + map PWA.** Optional geo-gate: `VITE_LAUNCHED_CITIES=Seattle,WA`.
See [PRD.md](PRD.md). Do not restore Signal or a dual-mode flag.

## What this PR adds (product)

| Area | In-repo |
|------|---------|
| Trust | Server `venue_claims` + RLS; inbox reads verified claims / `venue_staff`; reporter list + admin report status |
| Map | Clustering on the 533-venue catalog; neighborhood + energy pills; Launch 33 vs All Seattle |
| Growth | Stable `/venue/:id` share URLs, copy/share, OG card at `/api/share/venue`, venue-surge stub (not Signal push) |

## Human ops still required

These cannot be completed from this agent (no GitHub admin UI, no Vercel token, no live-loop proof on prod).

### #64 — Confirm Vercel env + prove live loop

Migrations are **largely applied** on production Supabase `xeldqwhztcnnvazmshzh` (venue schema, `live_reviews`, 533 Seattle venues). Remaining:

1. Confirm Vercel production env (and rebuild):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (legacy alias `SUPABASE_SERVICE_ROLE`)
   - `CRON_SECRET`
   - Do **not** set `VITE_APP_MODE`
2. Prove the live loop on https://pulse-chi-nine.vercel.app/ — sign in, post a live review, confirm Live now + map toast / Surging without refresh.

**New migration to paste** (SQL editor; history versions there do not match repo filenames):

- `supabase/migrations/20260910140000_venue_claims_and_report_queue.sql`
- Verify with `supabase/verify/venue_claims.sql`

Then close #64 when the two remaining boxes are checked.

### #65 — Branch protection (human GitHub UI)

Exact clicks: [docs/runbooks/github-branch-protection.md](docs/runbooks/github-branch-protection.md).

Required checks: `smoke-preview` and/or `smoke-preview-venue`.  
Remove any required check named `smoke-preview-signal` or `e2e-signal`.  
Solo maintainer: admin bypass **or** required reviews = 0.

### #66 — Signal Web Push

**Close as not planned** (or leave closed). The Signal VAPID / closed-app reminder path was removed with the product.

If we want push later, open a **new** venue-specific issue (surge alerts when a followed venue goes Electric). Do not revive Signal push. In-repo stub: `src/lib/venue-surge-watch.ts` (`describeVenueSurgePushStub`).

## Apply claims migration (prod)

Project: `xeldqwhztcnnvazmshzh`.

1. Supabase → SQL editor
2. Paste `20260910140000_venue_claims_and_report_queue.sql`
3. Run `supabase/verify/venue_claims.sql`
4. Confirm `venue_claims` exists with RLS on, and `pulse_reports.status` is present

Do **not** drop leftover `signal_*` tables without a dedicated review.

## Parked

- Apple Health / Google Fit
- AI concierge, ticketing, creator economy, video feed
- Invented Pulse Pro pricing or Stripe
- Restoring Pulse Signal or a Signal-default flip
- Closed-app Web Push (unless a new venue-surge issue is opened)
