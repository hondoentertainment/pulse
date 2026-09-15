# Pulse — Recommended Next Steps

> Updated 2026-09-15. **Pulse is venue + map only** (Signal removed; no `VITE_APP_MODE`).
> Production: https://pulse-chi-nine.vercel.app/ · Catalog: 533 Seattle venues.
> Detail maps: [docs/next-steps.md](docs/next-steps.md) · Claims ops: [docs/runbooks/venue-claims-ops.md](docs/runbooks/venue-claims-ops.md).

## Intake summary

| Track | Items | Who |
|-------|-------|-----|
| A — Ship ready code | Next-15 PRs landed (#105 merged; #104 closed as superseded; #106 docs on `main`) | Maintainer |
| B — Human ops / prod proof | Env, live loop, branch protection, #85/#86 | Human admin |
| C — Agent-safe polish | ENG-1 done; remaining items after B or while waiting on credentials | Agent / maintainer |
| Parked | Explicitly out of scope | — |

**Recommended next action:** Prove #85/#86 on production and close them. Confirm Vercel env + live review loop (OPS-1 / #64).

> **2026-09-15 agent pass:** ENG-1 Playwright smoke + CI wiring landed on this branch; OPS-2 schema verified present on prod via Supabase MCP (see [docs/runbooks/prod-next-steps-checklist.md](docs/runbooks/prod-next-steps-checklist.md)). #105/#106 are on `main`; Vercel env, branch protection, and live #85/#86 proof remain **human-only**.

---

## Prioritized queue

### Track A — Ship ready code (do first)

1. **[SHIP-1] Merge #105 — next-15 thread / Same / Crew / Maps / Last night** — P0 | Effort: S | Impact: High — **DONE (merged to `main` as `a6b6f10`, 2026-09-15)**  
   - Why now: Ready for review (not draft), mergeable, CI green (lint/test/build/typecheck/smoke/audit). Lands the stacked usage features on `main`.  
   - Dependencies: none for merge; leave #85/#86 open until prod proof.  
   - Acceptance:
     - [x] #105 merged to `main`
     - [ ] Production/preview redeploy succeeds
   - Verification: GitHub merge + Vercel production deploy healthy

2. **[SHIP-2] Merge or close #104 — next-15 usage roadmap** — P1 | Effort: S | Impact: Medium — **DONE (closed as superseded after #105, 2026-09-15)**  
   - Why now: #105 is stacked on / rebased onto #104; if #105 already contains the #104 surface, close #104 as superseded after #105 lands. If not, merge #104 next.  
   - Dependencies: Prefer #105 first to avoid fighting the stack.  
   - Acceptance:
     - [x] Either #104 merged, or closed with comment “superseded by #105”
   - Verification: `main` has hood `/n/:slug` pages, night-coach cron, recents row

### Track B — Human ops / prod proof (blocks “done” for trust + growth)

3. **[OPS-1 / #64] Confirm Vercel env + prove live loop** — P0 | Effort: S–M | Impact: Stability  
   - Why now: Code assumes Supabase; fixture-only prod is not a real nightlife loop.  
   - Acceptance:
     - [ ] Vercel production has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (rebuild after set)
     - [ ] Do **not** set `VITE_APP_MODE`
     - [ ] Sign in on https://pulse-chi-nine.vercel.app/, post a live review, confirm Live now + map/Surging without refresh
   - Verification: Manual prod walkthrough; then close remaining #64 boxes

4. **[OPS-2] Apply remaining additive SQL (if not already on prod)** — P0 | Effort: S | Impact: Trust / growth — **VERIFIED PRESENT (agent MCP, 2026-09-15)**  
   - Project: `xeldqwhztcnnvazmshzh`  
   - Confirmed on prod: `venue_claims.work_email` + `work_email_confirmed_at`, `try_verify_venue_claim_by_email_domain`, `follows.target_venue_id`, `push_tokens.p256dh`/`auth`/`platform`, `pulse_reports.status`/`reviewed_at`.  
   - Still human: only re-apply SQL if a fresh environment is missing these; do **not** recreate; do **not** drop leftover `signal_*` tables. Checklist: [docs/runbooks/prod-next-steps-checklist.md](docs/runbooks/prod-next-steps-checklist.md).

5. **[OPS-3 / #85] Prove venue claim → owner inbox E2E on prod** — P1 | Effort: M | Impact: Trust  
   - Code is in-repo; issue stays open until live proof.  
   - Acceptance (from issue):
     - [ ] Claim submit → pending visible to claimant
     - [ ] Verified claim (domain-match or `/ops` admin) unlocks `/venue/:id/inbox`
     - [ ] Pending does **not** unlock inbox
     - [ ] Reply / dismiss report works for verified owner; guest blocked
   - Runbook: [docs/runbooks/venue-claims-ops.md](docs/runbooks/venue-claims-ops.md)  
   - Verification: Real Seattle venue + real signed-in accounts on prod → close #85

6. **[OPS-4 / #86] Prove share OG + I’m-here pin on a real device** — P1 | Effort: S | Impact: Growth  
   - Acceptance:
     - [ ] Share URL `/api/share/venue?venueId=` shows venue name + freshness in iMessage/Slack crawl
     - [ ] I’m-here focuses the map pin; guest can view; write still requires `/auth`
   - Verification: Phone + crawler preview → close #86

7. **[OPS-5 / #65] Branch protection for solo maintainer** — P1 | Effort: S | Impact: Velocity  
   - Runbook: [docs/runbooks/github-branch-protection.md](docs/runbooks/github-branch-protection.md)  
   - Required checks: `smoke-preview` and/or `smoke-preview-venue`  
   - Remove any required `smoke-preview-signal` / `e2e-signal`  
   - Solo maintainer: admin bypass **or** required reviews = 0  
   - Verification: Open a no-op PR; confirm checks + merge path

8. **[OPS-6] Optional credentials / ops unlocks** — P2 | Effort: S each | Impact: Medium  
   - Set `app_metadata.role = admin` for `/ops` (domain-match claims can verify without this)  
   - Optional VAPID trio for venue-surge push stub (`VAPID_*` / `VITE_VAPID_PUBLIC_KEY`) — missing keys = honest no-op  
   - Custom domain + branded magic-link: [docs/runbooks/custom-domain.md](docs/runbooks/custom-domain.md) — live URL stays `pulse-chi-nine.vercel.app` until DNS attach  
   - Cold-start measure: hard reload `/`, confirm `pulse_map_interactive` ≲ 2s on a mid phone ([docs/next-steps.md](docs/next-steps.md))

### Track C — Agent-safe / later (only if A+B wait, or after ship)

9. **[ENG-1] Venue smoke expansion** — P2 | Effort: M | Impact: Regression safety — **DONE (agent, 2026-09-15)**  
   - Playwright coverage for claim → inbox gate, share deep link, I’m-here pin in `e2e/venue-claim-share.spec.ts`, wired into `test:smoke:venue` + CI. Verified unlock uses e2e-only `sessionStorage` seed (no invented admin).  
   - Acceptance: smoke exercises pending-lock + share/`here=` URL focus without prod secrets.

10. **[ENG-2] Lint warning trend-down** — P3 | Effort: M | Impact: Velocity  
    - Zero errors already; do **not** raise `--max-warnings`. Trim unused exports / `any` / a11y warnings incrementally.

11. **[ENG-3] Auth + offline + realtime integration tests** — P3 | Effort: L | Impact: Stability  
    - From [NEXT_PHASES.md](NEXT_PHASES.md) Phase 2.2: `use-supabase-auth`, offline queue sync, realtime subscription handling — only after prod loop is proven.

### Track D — Parked (do not schedule)

- Restoring Pulse Signal or any `VITE_APP_MODE` dual shell  
- Closing #66 as “Web Push for Signal” — **not planned**; if needed, open a **new** venue-surge push issue  
- Apple Health / Google Fit, AI concierge, ticketing, creator economy, video feed  
- Invented Pulse Pro pricing / Stripe  
- Second city beyond Seattle  
- Mass deletes of OSM catalog rows  
- Dropping leftover `signal_*` tables without a dedicated review  

---

## Decision

**Pulse is the nightlife venue + map PWA.** Signal is gone. See [PRD.md](PRD.md). Optional geo-gate: `VITE_LAUNCHED_CITIES=Seattle,WA`.

## Assumptions

- No active production incident.  
- #85/#86 remain open until a human proves them on prod (in-repo work already landed via #101–#103).  
- #73 Signal feature work is historical; do not reopen Signal as the shipping product.  
- Solo maintainer still owns Supabase / Vercel / GitHub admin.
