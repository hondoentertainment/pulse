# PRD — AI Concierge Eval Harness

Status: draft · Owner: Concierge team · Last updated: 2026-04-18

## Problem

The AI concierge (`api/concierge/chat.ts`) turns a free-form brief
("three friends, chill pre-dinner, $120, Nolita") into a multi-stop plan
of real venues. Plan quality is invisible to unit tests: tool calls can
succeed while the plan fabricates venues, misses a hard constraint
(accessibility, dietary), or exceeds the budget. We need a repeatable,
model-graded harness that:

1. Catches regressions when the system prompt, tool schema, or model
   changes.
2. Gates prompt-version rollout on a measurable quality threshold.
3. Produces a cost / latency budget per brief so we notice perf drift.

## What is evaluated

Each brief is scored across **four rubrics**, combined into a single
0–10 score. A brief passes if the aggregate score ≥ 7 and all hard
constraints are respected.

| Rubric            | What the judge checks                                                      | Weight |
| ----------------- | -------------------------------------------------------------------------- | ------ |
| Plan acceptability | Reads as a plan a human would actually execute: ordered, coherent, fun.   | 3      |
| Venue accuracy     | Every venue named exists in the tool's response — no fabrication.          | 3      |
| Constraint fit     | Respects budget cap, accessibility, dietary, time window, group size.      | 3      |
| Tool-call precision | The model called the search / plan tools with sensible arguments; no loops. | 1      |

Hard failures (automatic `pass: false` regardless of score):

- Names a venue not present in any tool result (hallucination).
- Final plan total exceeds `max_cost` by more than 10%.
- Brief specifies accessibility / dietary constraint and plan ignores it.
- Includes a venue in `must_not_venues` (e.g. moved / closed).

## Scoring rubric prompt

Full text in `evals/concierge/judge-prompt.md`. The judge is
`claude-sonnet-4-6`, called via `api/_lib/anthropic.ts`. Input:

- The original brief + context.
- The final assistant plan (parsed from SSE).
- The tool-call trace (for venue provenance).
- The rubric.

Output JSON shape:

```json
{
  "score": 8.5,
  "pass": true,
  "per_rubric": { "acceptability": 9, "accuracy": 10, "constraint": 8, "precision": 7 },
  "reasons": ["Plan orders stops by proximity", "Missed vegan requirement on stop 2"]
}
```

## Golden dataset

`evals/concierge/golden-dataset.json` — 50 briefs. Dimensions covered:

- City: NYC (25), SF (15), LA (10).
- Group size: 1–10.
- Budget: $30 (solo coffee) → $500 (birthday).
- Vibes: chill, wild, date, birthday, networking.
- Time: pre-dinner, dinner, late-night, brunch.
- Accessibility: wheelchair, low-sensory, nursing-friendly.
- Dietary: vegetarian, vegan, halal, gluten-free.
- Edge cases: moved venue (must_not_venues), closed day, surge high.

Each brief includes optional `must_have_venues`, `must_not_venues`,
`acceptable_purposes`, `min_stops`, `max_cost`.

## Prompt-version gating

- `api/_lib/concierge-prompts.ts` exports `PROMPT_VERSION` (e.g.
  `'v1-2026-04'`). The edge function logs this on session creation via
  a new column `concierge_sessions.prompt_version` (migration
  `20260417000017_concierge_prompt_version.sql`).
- Eval results embed `prompt_version`. CI compares against the previous
  run in `evals/concierge/results-history.json` and fails if:
  - overall pass rate < 80%, or
  - mean score drops by more than 0.5 vs. the last green run on the
    same prompt version, or
  - any new hard-fail class appears.
- A prompt bump is considered "green" only after one nightly run at
  ≥ 85% pass rate.

## Runbook

- Manual: `bun run evals:concierge` (requires `BASE_URL` pointing at a
  running server; `ANTHROPIC_API_KEY` for the judge).
- Nightly: `.github/workflows/concierge-evals.yml` cron 06:00 UTC.
- On PRs that touch `api/_lib/concierge-*.ts`, the workflow comments
  the delta on the PR.

## Non-goals (v1)

- Playwright-level end-to-end (streaming UX, multi-turn). Tracked as a
  follow-up — the harness reuses the `/chat` HTTP surface today.
- Cost benchmarking beyond $ per run. Tokens are reported; a per-brief
  budget lives in the JSON summary for trend spotting.
- Human-in-the-loop review. Results are stored as artifacts so a
  reviewer can scan the lowest-scoring briefs; no UI is shipped yet.
