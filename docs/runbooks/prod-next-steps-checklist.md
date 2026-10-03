# Prod next-steps checklist (agent-verified + human blockers)

> Updated 2026-09-24. Pulse is **venue + map only**. Production: https://pulse-chi-nine.vercel.app/  
> Supabase project ref: `xeldqwhztcnnvazmshzh`

## Agent-verified on 2026-09-15 (Supabase MCP)

| Check | Result |
|-------|--------|
| Core tables present with RLS | `venue_claims`, `venue_staff`, `pulse_reports`, `follows`, `push_tokens`, `notifications` — all RLS on |
| Domain-claim columns | `venue_claims.work_email`, `work_email_confirmed_at`, `evidence`, `status` present |
| Domain verify RPC | `try_verify_venue_claim_by_email_domain` present |
| Follows | `follows.target_venue_id` present (reuse `follows`; no `venue_follows`) |
| Web push columns | `push_tokens.p256dh`, `auth`, `platform` present; web endpoint lives in `token` when `platform='web'` |
| Owner report triage | `pulse_reports.status`, `reviewed_at` present |
| Catalog | ~536 venues on prod |
| Leftover `signal_*` tables | Still present — **do not drop** without a dedicated review |

`spatial_ref_sys` has RLS off (PostGIS system table). Do not “fix” by enabling RLS without policies.

## Human-only (cannot be closed by the agent)

### SHIP

- [x] **SHIP-1** Merge [#105](https://github.com/hondoentertainment/pulse/pull/105) — landed on `main` as `a6b6f10`
- [x] **SHIP-2** [#104](https://github.com/hondoentertainment/pulse/pull/104) closed as superseded after #105

### OPS / prod proof

- [ ] **OPS-1 / #64** Confirm Vercel env + rebuild: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Do **not** set `VITE_APP_MODE`. Prove live review loop on prod.
- [ ] **OPS-3 / #85** Prod claim → pending → verified unlock → owner inbox reply/dismiss (see [venue-claims-ops.md](venue-claims-ops.md))
- [ ] **OPS-4 / #86** Phone + crawler: `/api/share/venue?venueId=` OG + I’m-here pin
- [ ] **OPS-5 / #65** Branch protection: require `smoke-preview` / `smoke-preview-venue`; remove Signal checks; solo reviews = 0 or admin bypass ([github-branch-protection.md](github-branch-protection.md))
- [ ] **OPS-6** Optional: `app_metadata.role=admin` for `/ops`; VAPID trio already on Vercel (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY`) — do not invent secrets; custom domain ([custom-domain.md](custom-domain.md))
- [ ] **OPS-7 / WC-0.5** `VITE_ANALYTICS_BACKEND` + provider key. Until set, funnel events stay console/no-op.
- [ ] **OPS-8** Apply `supabase/migrations/20260924153000_venue_surge_and_owner_replies.sql` on `xeldqwhztcnnvazmshzh`. Verify with `supabase/verify/venue_surge_owner_replies.sql`. Then prove [#109](https://github.com/hondoentertainment/pulse/issues/109) (not Signal #66).

## Agent-shipped in-repo (this pass)

- [x] **ENG-1** Playwright smoke: claim gate, pending lock, verified seed unlock, share deep link, I’m-here (`e2e/venue-claim-share.spec.ts` wired into `test:smoke:venue` + CI)
- [x] **OPS-2 verify** Additive claim/follow/push/report schema confirmed present on prod via MCP (no migration re-apply needed from this agent)
