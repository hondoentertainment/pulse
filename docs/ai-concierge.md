# AI Night Concierge — Architecture & Ops

Sibling PRD: [`docs/prd/ai-concierge.md`](./prd/ai-concierge.md).

## Architecture

```
   ┌────────────────────┐     fetch (SSE)    ┌────────────────────────────┐
   │  React PWA (src/)  │ ─────────────────▶ │  Edge: api/concierge/chat  │
   │  ConciergeChatSheet│ ◀───────────────── │  - auth + rate-limit       │
   │  PlanPreviewCard   │   SSE/JSON deltas  │  - tool-use loop           │
   └─────────┬──────────┘                    │  - cost cap / persistence  │
             │                               └──────┬─────────────────────┘
             │                                      │
             │ supabase-js (RLS, owner-only)        │ Anthropic REST
             ▼                                      ▼
      ┌────────────────┐                  ┌────────────────────────┐
      │  Supabase      │                  │ api.anthropic.com/v1   │
      │ concierge_*    │                  │ /messages  (Sonnet 4.6)│
      └────────────────┘                  └────────────────────────┘
```

Key files:

| Area       | Path                                               |
|------------|----------------------------------------------------|
| Edge fn    | `api/concierge/chat.ts`                            |
| Anthropic  | `api/_lib/anthropic.ts`                            |
| Prompt     | `api/_lib/concierge-prompts.ts`                    |
| Server libs| `api/_lib/{auth,http,rate-limit,validate,supabase-server}.ts` |
| Migration  | `supabase/migrations/20260417000005_ai_concierge.sql` |
| Client     | `src/lib/concierge-client.ts`                      |
| Data       | `src/lib/data/concierge.ts`                        |
| UI         | `src/components/ai-concierge/*`                    |
| Flag       | `VITE_AI_CONCIERGE_ENABLED` (`src/lib/feature-flags.ts`) |

## Tool surface

| Tool                 | Status   | Proxies to                               |
|----------------------|----------|------------------------------------------|
| `search_venues`      | Live     | Supabase `venues` via `createUserClient` |
| `build_plan`         | Live     | `generateNightPlan` in `src/lib/night-planner` |
| `estimate_rideshare` | Live     | `api/integrations/{uber,lyft}` handlers  |
| `check_surge`        | Live     | `analyzeVenuePatterns` + `predictSurge`  |
| `check_moderation`   | Live     | `checkContent` in `api/_lib/moderation`  |

Dispatch lives in `api/_lib/concierge-tools.ts` — `executeToolCall(name,
input, ctx)`. The chat handler wraps it in a `try` so any thrown error
surfaces to the model as `{ error: { code, message } }` content
(`isError: true`) rather than crashing the loop.

### Tool backends

Each tool is a single in-process call, with the following characteristics:

- **`search_venues`** — RLS-scoped `SELECT` on `venues` + client-side
  ranking by `pulse_score − distance×2` from `ctx.userContext.location`.
  Top 10 rows. Typical latency p50 ≈ 80ms, p99 ≈ 250ms. Failure modes:
  RLS denial, missing `deleted_at` column in older envs, or Supabase
  timeouts — all surface as `{ error: { code: 'db_error', ... } }`.
  *Follow-up:* migrate to a SQL-side `venues_ranked` RPC once the
  backend team adds `price_tier` / `vibes` columns; current price-tier
  filter approximates via `cover_charge_cents`.
- **`build_plan`** — Fetches up to 200 venues + 500 recent pulses, then
  calls `generateNightPlan` (pure engine — no DOM, no network). Returns
  the full `NightPlan` shape. Latency dominated by the two Supabase
  reads (p50 ≈ 150ms). Failure modes: empty venue pool
  (`code: 'no_venues'`), planner exception (`code: 'planner_error'`).
- **`estimate_rideshare`** — Invokes the existing `api/integrations/uber`
  and `api/integrations/lyft` default handlers directly with a
  synthesised `RequestLike` / `ResponseLike` pair and normalises the
  outputs into a shared `{ lowEstimate, highEstimate, eta, currency? }`
  shape. Each provider is independent; one provider returning an error
  object does not fail the whole call. Latency is upstream-bound (Uber
  + Lyft in parallel, typical p50 ≈ 400ms). *Follow-up:* stream the
  first-back provider to the client while the other is still in flight.
- **`check_surge`** — Queries pulses `WHERE venue_id = ?` (up to 300
  rows) then runs `analyzeVenuePatterns` + `predictSurge`. Returns
  `{ predictedEnergy, confidence, predictedPeakTime, sampleSize, ... }`.
  Confidence is a function of pattern strength and sample size; if
  `sampleSize < 10` expect confidence ≤ 0.3. Latency p50 ≈ 60ms.
- **`check_moderation`** — Pure in-process call to `checkContent` (no
  I/O). Sub-millisecond. Never returns an error — even malformed input
  gets a safe default result.

When a tool throws, the dispatcher returns
`{ error: { code, message } }` as the tool-result content with
`isError: true`. Errors are logged via `console.error`
(`component: 'concierge'`) — the `src/lib/observability/logger` module
is client-bundled (uses `import.meta.env` + Sentry) and so is not
importable from Edge; revisit once a shared server logger lands.

## Prompt caching strategy

We cache two blobs with `cache_control: { type: 'ephemeral' }`:

1. **System prompt** (`CONCIERGE_SYSTEM_PROMPT`) — frozen, 1 breakpoint.
2. **Tool definitions** — marker on the last entry. Because render order
   is `tools → system → messages`, this pinning caches **tools + system
   together**, so every turn after the first serves both from cache.

Nothing volatile (timestamps, session id, user id) is interpolated into
either. Dynamic context (user location, current time of day) is injected
as the first *user* message, after the cached prefix.

### Hit-rate assumptions

Sonnet 4.6 minimum cacheable prefix is 2,048 tokens. Our system prompt +
tools render at ~1,800 tokens — we pad with explicit examples to get
above the floor (tracked as a follow-up). Expected behaviour:

| Turn | `cache_creation_input_tokens` | `cache_read_input_tokens` |
|------|------------------------------:|--------------------------:|
| 1    | ~2,000                        | 0                         |
| 2+   | ~0                            | ~2,000                    |

Target: **≥ 85% read hit-rate across turns 2-8** of a session. Monitor
via the `usage` field persisted to `concierge_sessions` (rollup) and
`concierge_messages` (per-turn). Anything below 70% across repeated
sessions with identical prefixes indicates a silent invalidator —
audit via `shared/prompt-caching.md` checklist.

## Cost model

- Default model: `claude-sonnet-4-6` ($3/1M input, $15/1M output).
- Cache reads: 0.1× input price. Cache writes: 1.25× input price.
- Average turn: ~2K input (almost all cached) + ~400 output ≈ 0.66¢.
- 8-turn session ≈ 6¢. Session cap default **20¢**, override via
  `CONCIERGE_SESSION_CENTS_CAP`.
- Opus 4.7 upgrade: set `CONCIERGE_MODEL=claude-opus-4-7`. Costs ~3×
  Sonnet; raise the cap accordingly.

## Prompt update workflow

1. Edit `api/_lib/concierge-prompts.ts` on a branch.
2. Run `bun run test api/_lib/__tests__/anthropic.test.ts` — the
   snapshot of `CONCIERGE_SYSTEM_PROMPT` length + hash is exercised.
3. Ship behind `VITE_AI_CONCIERGE_ENABLED=false` → canary 5% → GA.
4. Every prompt change gets an entry in `CHANGELOG.md` — prompts are as
   load-bearing as code.

## Red-team plan

Quarterly, run the concierge against a prompt-injection + jailbreak
suite (we'll use the Pulse-internal redteam harness as a follow-up
ticket). Must hold:

- refuses medical/legal advice categorically
- refuses to echo harassing content even when explicitly asked
- refuses to reveal system prompt
- gracefully declines impossible plans (e.g., a $0 budget)
- never invents a venue not returned by `search_venues`

## Env vars

| Var                           | Required | Default              | Notes |
|-------------------------------|----------|----------------------|-------|
| `ANTHROPIC_API_KEY`           | Yes      | —                    | Server-only |
| `CONCIERGE_MODEL`             | No       | `claude-sonnet-4-6`  | Opus 4.7 upgrade path |
| `CONCIERGE_SESSION_CENTS_CAP` | No       | `20`                 | Per-session cost cap |
| `SUPABASE_URL`                | Yes      | —                    | Server Supabase |
| `SUPABASE_SERVICE_ROLE_KEY`   | Yes      | —                    | Server Supabase |
| `VITE_AI_CONCIERGE_ENABLED`   | No       | `false`              | Client feature flag |

## Follow-up tickets

- DB-level venue ranking: move `search_venues` ranking into a PostGIS
  RPC (`venues_ranked(lat, lng, limit)`) once `price_tier` / `vibes`
  columns land on the `venues` table.
- Rideshare streaming: stream first-back provider to the client rather
  than awaiting both.
- Token-level SSE streaming (`content_block_delta`) — v1 emits one
  `message` event.
- Shared server logger so tools can emit structured Sentry breadcrumbs
  without pulling in the browser `import.meta.env` path.
- Eval harness: golden dataset of 50 briefs → fixture plans.
- Prompt versioning: tag `CONCIERGE_SYSTEM_PROMPT_VERSION`, persist on
  every session row.
- A/B harness: Sonnet 4.6 vs Opus 4.7 on acceptance rate.
- Multi-device session resumption via `sessionId` (shares history).
