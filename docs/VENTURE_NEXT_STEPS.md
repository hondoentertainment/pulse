# Venture roadmap — next steps (execution checklist)

This repo’s **shipped web entry** is `src/App.tsx` → **venue + map** (`VenueApp` / `AppRoutes`). Pulse Signal (personal check-in) was removed; there is no app-mode switch.

**Decision:** Pulse is the nightlife venue + map PWA. Optional geo-gate: `VITE_LAUNCHED_CITIES=Seattle,WA`. See [RECOMMENDED_NEXT_STEPS.md](../RECOMMENDED_NEXT_STEPS.md) and [PRD.md](../PRD.md).

## Implemented in codebase

- **Venue core loop** — map, venue page, pulse create, trending.
- **Auth + persistence** — Supabase when `VITE_SUPABASE_*` is set; otherwise seeded fixtures.
- **Venue analytics** — `app_open`, `venue_view`, `pulse_submit`, and related events in `@/lib/analytics`.

## Your weekly habits (not automatable)

| Habit | Outcome |
|--------|---------|
| Apply / confirm production venue migrations + env | Persistence actually works |
| Review **Vercel Analytics** for venue / pulse events | Activation & drop-off visibility |
| **User interviews** — target 2–5 per week | ICP and wording |
| **Metrics stand-up** | D1/D7 pulse / check-in retention |

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_LAUNCHED_CITIES` | Venue geo-gate. `Seattle,WA` is one market. |
| `VITE_RESEARCH_FEEDBACK_URL` | Optional. Survey or Calendly in Settings. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Persistence (rebuild required) |

## CI / engineering

- **Production build:** `npm run build` (uses `tsc -b --noCheck`).
- **Strict typecheck:** `npx tsc -b`.
- **Required smoke:** `smoke-preview` aliases `smoke-preview-venue`.
- **Tests:** `npm run test` and `npm run test:smoke:venue` before release.

## Series A narrative alignment

Keep UI, manifest, and copy on **one product** (Pulse venue + map). Do not pitch the retired Signal check-in product.
