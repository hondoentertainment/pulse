# Venture roadmap — next steps (execution checklist)

This repo’s **shipped web entry** is `src/App.tsx` → **Pulse Signal** (`LoginScreen` → `SignalApp`). The venue / discovery shell is `src/AppRoutes.tsx` (not mounted from that entry). See comments in those files.

## Implemented in codebase

- **Activation analytics** — `signal_*` events in `@/lib/analytics` (Vercel Analytics + in-memory log). Funnel helper: `analyzeSignalFunnel(getEvents())`.
- **Research / pilot surface** — Settings: Pro pilot CTA + optional `VITE_RESEARCH_FEEDBACK_URL` link.
- **Timezone-stable retention helpers** — `generateNightRecap` / `generateDailyDrop` use explicit UTC in date windows where tests depended on local TZ.

## Your weekly habits (not automatable)

| Habit | Outcome |
|--------|---------|
| Review **Vercel Analytics** (or export) for `signal_*` event counts | Activation & drop-off visibility |
| **User interviews** — target 2–5 per week | ICP and wording |
| **One growth experiment** | Channel learning |
| **Metrics stand-up** | D1/D7 check-in retention (define in your analytics backend if needed) |

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_RESEARCH_FEEDBACK_URL` | Optional. Survey, Typeform, or Calendly URL for Settings → Share feedback. |

## CI / engineering

- **Production build:** `npm run build` (uses `tsc -b --noCheck`).
- **Strict typecheck:** `npx tsc -b` — still blocked by legacy venue typings; chip away or scope `tsconfig` exclude for diligence.
- **Tests:** `npm run test` — run locally before release; fix file-by-file if failures remain outside retention.

## Series A narrative alignment

Keep UI, manifest, and copy on **one product** (Pulse Signal). Ship logs and `signal_*` events support a credible “we measure activation” story for investors.
