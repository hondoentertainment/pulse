# Pulse next steps — Figma → shipped surfaces

Maps issues **#84–#87** plus the soon stack (PWA / trust chips / ops / analytics / catalog) onto in-app surfaces. Signal stays removed.

Figma: [Uber UX Targets](https://www.figma.com/design/wsJG3tGvfsLuUcVRfKpqS4?node-id=6-2) (`node-id=6-2`). Visual overlay: [Uber × X UX](uber-x-ux.md).

## Issue mapping

| Issue | Figma / intent | Surfaces | Notes |
|-------|----------------|----------|-------|
| **#84** Hardening | First session + guest write + live create | `getWriteAuthRedirect`, `closeComposerForAuthRedirect`, `CreatePulseDialog`, `markMapInteractive`, Launch 33 default | Guest check-in/create **closes the composer** and navigates `/auth` (never toast-only). Cold-start helper: Performance marks `pulse_nav_start` → `pulse_map_interactive`. Target **&lt;2s feel** with Launch 33 first; All Seattle + Surging rail deferred via `requestIdleCallback`. Measure in DevTools or `formatColdStartDebug()`. Signed-in create still optimistic + realtime (`use-map-live-reviews`). No new Signal paths. |
| **#85** Trust | Owner inbox v2 (`6:83`) | `/venue/:id/inbox`, `venue_claims` RLS, `/ops`, `docs/runbooks/venue-claims-ops.md` | Claim + evidence → pending visible to claimant. **Pending does not unlock inbox.** Verified claim or `venue_staff` unlocks tonight’s reviews, reply (local), dismiss (local + `PATCH /api/pulses/report` when RLS applied). Guest/unverified blocked. Admin verify: `/ops` if `app_metadata.role=admin`, else SQL runbook. Optional migration `20260911000000_owner_report_triage.sql`. |
| **#86** Growth | Share deep link (`6:74`) | `/api/share/venue`, `/api/share/og`, `/?here=:id`, `ShareArrivalCard` | OG title = venue name; energy line includes **freshness** from latest pulse. Deep link `/venue/:id?from=share` shows mid-energy (score + Live now + share card). **I’m here** focuses the map pin. Signed-in: also opens create. Guests **view** the pin; writes still `/auth`. |
| **#87** For tonight | Home (`6:62`) | `TonightHomeHeader`, `neighborhood-geo`, `catalog-quality` | `Tonight · {hood}` from geolocation boxes, else saved pref / nearest catalog hood / **Capitol Hill Launch 33**. Ranks start-here + heating-up from live energy + distance + time of day. Empty state teaches **map → venue → pulse**. Real Seattle catalog only. Guests browse; create auth-gated. |
| **#90** PWA / offline | Reliability (`6:92`) | `InstallAffordance`, `OfflineBanner`, `MapHomeSkeleton` | Map-home install card when eligible, plus a non-blocking browser-menu / iOS Share path. Offline banner + draft + skeleton bars; Keep browsing. |
| **#89** Trust v2 | Trust at a glance (`6:2`) | `TrustPinChips` on map hover + Tonight + Surging | Freshness / Verified or **Claimed** / density. Claimed only when `venue_claim_badges` / verified claim exists — never invented. |
| **#91 Moderation ops** | — | `/ops`, runbook | Gated admin queue: venue **name**, verify/reject, dismiss/**resolve** reports. SQL helpers if no admin role. |
| **#92 Analytics funnel** | — | `guest_map_view`, `venue_open`, `auth_start`, `first_pulse_create` | Exact names from #92. `guest` boolean, no PII. See [observability.md](observability.md#guest--first-pulse-funnel-92). |
| **#93 Catalog quality** | — | `catalog-quality.ts`, `compareTonightRank`, `npm run catalog-quality` | Neighborhood + Launch 33 / All Seattle labels. Tonight prefers curated when tied. Soft-hide bad / OSM-dupe pins from ranking only. **No mass prod deletes.** |

## Cold-start measurement

1. Hard reload `/` (Launch 33 default — `inventoryLayer: 'curated'`).
2. DevTools → Performance → look for `pulse_map_interactive` / measure `pulse_cold_start`.
3. Target: mark under ~2000ms on a mid phone. All Seattle clustering and the Surging rail wait until after first paint.

## Follow-ups blocked on credentials / admin

- Signing in on prod to prove the live-review loop (no credentials invented here).
- Applying `20260911000000_owner_report_triage.sql` on `xeldqwhztcnnvazmshzh` if owner dismiss should persist beyond localStorage.
- Applying `20260912000000_venue_claim_verified_badge.sql` so Tonight/map can show **Claimed** chips (pending still does not unlock inbox).
- Applying `20260912120000_venue_follows_push_claim_rate.sql` (follows, web push table, domain-match claim, pulse rate-limit). Verify with `supabase/verify/venue_follows.sql`, `web_push_subscriptions.sql`, `venue_claim_domain.sql`, `pulse_rate_limit.sql`.
- Setting Vercel env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY` (generate locally; do not invent prod secrets). Missing keys = honest no-op.
- Setting `app_metadata.role = admin` for `/ops` (domain-match claims can verify without this).
- Confirming OG cards on a real iMessage/Slack crawl (needs production deploy).
- Custom domain attach + branded magic-link: [custom-domain.md](runbooks/custom-domain.md). Live URL stays `https://pulse-chi-nine.vercel.app/` until a human attaches DNS.

## Ownership

- Owner: Pulse product / map + live reviews
- Last reviewed: 2026-09-12
