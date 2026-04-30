# PRD — AI Night Concierge

**Owner:** Pulse Product  **Status:** Draft  **Flag:** `VITE_AI_CONCIERGE_ENABLED` (off by default)

## 1. Problem

Planning a night out for a group with real constraints (budget, dietary,
neighborhood, end-time, accessibility) is the single most error-prone user
journey in Pulse. The existing Night Planner (`src/lib/night-planner.ts`)
produces solid multi-stop itineraries, but users have to fill out a form and
re-plan to iterate. Power users want a conversational interface that can
reason about trade-offs, answer "why" questions, and refine the plan
incrementally.

## 2. Goals

1. Let a user describe a night out in natural language and receive a
   bookable plan (venues, timing, rideshare, budget) in under 30 seconds.
2. Allow iterative refinement — "swap the first stop for Thai", "make it
   cheaper", "add wheelchair access".
3. Match Pulse's existing safety posture (no medical/legal advice, PII
   minimisation, moderation on any user-generated text that might be
   echoed).
4. Keep end-to-end cost per session ≤ 20¢ p95 at Claude Sonnet 4.6 pricing.

## 3. Non-goals

- Replacing the deterministic `generateNightPlan` engine. The concierge
  **wraps** it; the engine is still the source of truth.
- Agent-initiated bookings or payments. Those remain explicit user actions.
- Persistent multi-day memory across sessions (v2).

## 4. User stories

- **S1** "Plan 4 people, $80pp, Williamsburg, ends by 2am, one vegetarian,
  one wheelchair user." → Concierge returns 3-stop plan with transit legs,
  flags accessibility-vetted venues.
- **S2** "Same plan but cheaper" → Concierge re-invokes `build_plan` with
  revised budget; diffs stops.
- **S3** "Is The Flower surge-pricing right now?" → Concierge calls
  `check_surge` and `estimate_rideshare`, explains.
- **S4** "Save it and share with my crew" → Client taps "Save plan",
  persists to `concierge_plans`, deep-links crew.
- **S5** "My friend said something offensive, can I text it to the group?"
  → Concierge refuses to echo unmoderated content; calls `check_moderation`
  when in doubt.

## 5. Conversational flow

1. User opens `ConciergeButton` → sheet slides up, shows 3 sample prompts.
2. Client sends `{ messages, sessionId, userContext }` to
   `POST /api/concierge/chat`.
3. Server runs the Anthropic tool-use loop: Claude may call
   `search_venues`, `build_plan`, `estimate_rideshare`, `check_surge`,
   `check_moderation` — in any order, multiple times.
4. Server streams deltas over SSE. UI renders tool calls as inline cards
   (venue chips, plan preview) and final assistant text as bubble.
5. If a `build_plan` result is present in the final turn, the UI shows the
   `PlanPreviewCard` with Save / Refine / Share.
6. On Save: `saveAcceptedPlan` writes to `concierge_plans`.

## 6. Tool surface

| Tool                 | Proxies                                | Side effects |
|----------------------|----------------------------------------|--------------|
| `search_venues`      | `listVenues` (server-side)             | Read-only    |
| `build_plan`         | `generateNightPlan`                    | Read-only    |
| `estimate_rideshare` | `generateRideshareLink` / Uber+Lyft    | Read-only    |
| `check_surge`        | `predictSurge`                         | Read-only    |
| `check_moderation`   | `screenContent` / moderation endpoint  | Read-only    |

All tools are **read-only** for v1. Booking/payments remain explicit.

## 7. Guardrails

- **Auth** — Edge function requires Supabase session. Anonymous → 401.
- **Rate limit** — 5 messages / minute / user (`api/_lib/rate-limit.ts`).
- **Input size** — max 20 messages per request, max 8 KB per message.
- **Cost cap** — per-session spend cap (default 20¢, env
  `CONCIERGE_SESSION_CENTS_CAP`). Tokens accumulated in
  `concierge_sessions.total_cost_cents`; next request past the cap is
  rejected with a polite 402-style message.
- **PII minimisation** — the system prompt instructs Claude never to
  request more personal data than needed for planning (no full names,
  addresses beyond neighborhood, phone numbers).
- **Moderation** — Claude is told to call `check_moderation` before
  echoing any user-generated text publicly (e.g., if asked to compose a
  message to the crew).
- **No medical/legal advice** — system prompt refuses categorically.
- **Prompt caching** — system prompt + large venue-catalog context blob
  are cached with `cache_control: { type: 'ephemeral' }`.

## 8. Success metrics

| Metric                                | Target (30d)         |
|---------------------------------------|----------------------|
| Plan acceptance rate (Save / session) | ≥ 35 %               |
| P95 time-to-first-token                | ≤ 1.5 s              |
| P95 end-to-end plan generation         | ≤ 12 s               |
| Average cost / session                 | ≤ 8 ¢                |
| Cache read hit-rate on system prompt   | ≥ 85 % across turns  |
| Hard refusals (safety)                 | ≥ 99 % on red-team set |

## 9. Rollout

- Alpha: staff only behind flag.
- Beta: 5 % of NYC / LA / SF users, Sonnet 4.6 only.
- GA: flag default-on after the hit-rate + cost targets hold for 14 days.
- Escape hatch: env flip to Opus 4.7 for heavy planning experiments
  (`CONCIERGE_MODEL=claude-opus-4-7`).

## 10. Open questions

- Do we train a routing classifier to switch Sonnet → Haiku for simple
  follow-ups? Deferred to v2.
- Multilingual: v1 English only; i18n groundwork exists in `src/lib/i18n.ts`.
