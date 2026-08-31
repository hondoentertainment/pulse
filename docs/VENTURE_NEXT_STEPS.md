# Venture roadmap — next steps (execution checklist)

This repo’s **shipped web entry** is `src/App.tsx` → **Pulse Signal** (`LoginScreen` → `SignalApp`). The venue / discovery shell is `src/AppRoutes.tsx` (not mounted unless `VITE_APP_MODE=venue`).

**Decision (#56):** Pulse Signal is the default product. Venue discovery is dormant behind `VITE_APP_MODE=venue` (+ optional `VITE_LAUNCHED_CITIES=Seattle,WA`). See [RECOMMENDED_NEXT_STEPS.md](../RECOMMENDED_NEXT_STEPS.md) and [PRD_SIGNAL.md](../PRD_SIGNAL.md).

## Implemented in codebase

- **Activation analytics** — `signal_*` events in `@/lib/analytics`. Funnel helper: `analyzeSignalFunnel(getEvents())`.
- **Research / pilot surface** — Settings: Pro pilot email → `signal_pilot_signups` via `/api/signal/pilot`, plus optional `VITE_RESEARCH_FEEDBACK_URL`.
- **AM/PM + reminders** — unique window constraint, cron dispatch, honest reminder copy.
- **History tools** — CSV export, weekly summary, tag-pattern insights, account data delete.
- **Timezone-stable retention helpers** — `generateNightRecap` / `generateDailyDrop` use explicit UTC in date windows where tests depended on local TZ.

## Your weekly habits (not automatable)

| Habit | Outcome |
|--------|---------|
| Apply / confirm production migrations + env | Persistence and reminders actually work |
| Review **Vercel Analytics** for `signal_*` | Activation & drop-off visibility |
| **User interviews** — target 2–5 per week | ICP and wording; Pro offer only after waitlist emails |
| Prove closed-app Web Push once VAPID is set | Reminder loop is real |
| **Metrics stand-up** | D1/D7 check-in retention |

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_APP_MODE` | `signal` (default) or `venue` (staging only) |
| `VITE_LAUNCHED_CITIES` | Venue geo-gate. `Seattle,WA` is one market. |
| `VITE_RESEARCH_FEEDBACK_URL` | Optional. Survey or Calendly in Settings. |
| `VITE_VAPID_PUBLIC_KEY` / `VAPID_*` | Closed-app Web Push |

## CI / engineering

- **Production build:** `npm run build` (uses `tsc -b --noCheck`).
- **Strict typecheck:** `npx tsc -b` — still blocked by legacy venue typings.
- **Required smoke:** `smoke-preview` aliases `smoke-preview-signal`. Venue smoke is advisory.
- **Tests:** `npm run test` and `npm run test:smoke:signal` before release.

## Series A narrative alignment

Keep UI, manifest, and copy on **one product** (Pulse Signal). Ship logs and `signal_*` events support a credible “we measure activation” story. Do not pitch venue discovery as the live product while production titles Pulse Signal.
