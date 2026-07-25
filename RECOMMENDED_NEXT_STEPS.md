# Pulse — Recommended Next Steps

> Regenerated 2026-07-25 from a full audit against the **Pulse Signal** product
> (`VITE_APP_MODE=signal`, the production default). The previous revision was
> dated 2026-04-04, described the pre-pivot venue app, and reported a broken
> test suite that has long since been fixed.

## Current health snapshot

| Metric | Status |
|--------|--------|
| **Build** | Passes; bundle-size budgets OK |
| **Typecheck** (`tsc -b --noCheck`) | Clean |
| **Lint** | 0 errors (warnings within budget) |
| **Unit tests** | 1,190+ passing, 20 skipped |
| **E2E** | Signal smoke passing |
| **Product** | Pulse Signal ships by default; venue app dormant behind `VITE_APP_MODE=venue` |
| **Signal backend** | Tables added (`20260725000000_signal_core.sql`) — **must be applied to production** |

---

## Blocking launch

### 1. Apply the Signal migrations to the production Supabase project

`signal_entries` / `signal_profiles` / `signal_pilot_signups` now exist as
migrations but must actually be applied. Until they are, Signal is
**localStorage-only**: clearing browser data destroys a user's streak and
history, and there is no cross-device support. For a product whose value is
"check in daily for months," this is the single largest risk.

### 2. Production environment configuration

Vercel production needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
`VITE_APP_MODE=signal`, plus any of `VITE_SENTRY_DSN` / `VITE_MAPBOX_TOKEN` /
Stripe keys that are actually used. Missing values deploy green but run degraded.

### 3. Land the built-but-unmerged Signal features

Pattern discovery, personal records, weekly summary, CSV export, real daily
reminders, and pilot capture are implemented and tested but not on `main`.
Merging them is what makes the core loop pay off (see PRD_SIGNAL.md §2).

---

## High value, next

### 4. Server-side reminder delivery

Local scheduling covers "app open or backgrounded". Firing when the app is fully
closed needs a real VAPID key (the one in `pwa.ts` is a dev placeholder) and a
scheduled job reading `signal_profiles.reminder_enabled` / `reminder_time`.
Reminders are the primary retention lever for a daily-habit product.

### 5. Account deletion / data controls

CSV export exists; self-serve delete does not. Required for app-store review and
most privacy regimes.

### 6. Correlation-driven insights

`generateInsight` / `getRecommendation` are hand-written heuristics. The tag
correlation engine (`signal-patterns.ts`) already computes what actually moves a
user's score — feeding that into the daily recommendation is the obvious upgrade.

---

## Health & hygiene

### 7. `typecheck-strict` venue type debt

Bare `tsc -b` reports ~69 errors, **all** in dormant venue-app files (Venue type
and component-prop drift, stale test fixtures). It's cross-cutting, so partial
fixes give no gate benefit. Either fix it wholesale in a dedicated PR with venue
verification, or exclude the venue surface from the strict project if that
product stays dormant.

### 8. Decide the venue product's fate

It is a large, dormant surface carrying real maintenance cost (type debt, a
second e2e suite, mock data). Either commit to reviving it or archive it
deliberately — leaving it half-alive is the expensive option.

### 9. Documentation drift

`README.md` and the PRDs are now accurate. Remaining venue-era docs
(`PRODUCTION_ROLLOUT.md`, `NEXT_PHASES.md`, `IMPLEMENTATION_SUMMARY.md`,
`SOCIAL_PULSE_IMPLEMENTATION.md`) still describe the pre-pivot product and
should be archived or re-scoped.

---

## Deliberately not doing

- **Social features in Signal** — out of scope per PRD_SIGNAL.md §4.3
- **Clinical/diagnostic scoring** — the score is an explainable heuristic and
  must never be presented as a validated instrument
