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

| Tool                 | Status v1 | Proxies to                               |
|----------------------|-----------|------------------------------------------|
| `search_venues`      | Stub      | Planned: server-side `listVenues`         |
| `build_plan`         | Stub      | Planned: `generateNightPlan`              |
| `estimate_rideshare` | Stub      | Planned: `api/integrations/{uber,lyft}`   |
| `check_surge`        | Stub      | Planned: `predictSurge`                   |
| `check_moderation`   | Stub      | Planned: `screenContent` / moderation API |

Each stub returns a structured JSON shape tagged `{ stub: true, note }`
so the Claude loop exercises end-to-end in dev without blowing through
backend capacity. Replace each one-by-one as the backends harden; the
stubs document their own wiring targets.

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

- Wire real tool backends (`search_venues`, `build_plan`, …).
- Token-level SSE streaming (`content_block_delta`) — v1 emits one
  `message` event.
- Eval harness: golden dataset of 50 briefs → fixture plans.
- Prompt versioning: tag `CONCIERGE_SYSTEM_PROMPT_VERSION`, persist on
  every session row.
- A/B harness: Sonnet 4.6 vs Opus 4.7 on acceptance rate.
- Multi-device session resumption via `sessionId` (shares history).
