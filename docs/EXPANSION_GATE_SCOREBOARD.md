# Expansion gate scoreboard

PRD §15.1 / §20.10 — do **not** expand geography until all gates are true for **8 consecutive weeks**.

| Gate | Target |
|------|--------|
| Decision conversion | ≥ 35% |
| Fresh venue coverage (&lt;90 min) | ≥ 70% |
| Week-4 retention | ≥ 25% |
| Misleading signal rate | &lt; 10% |
| Scout weekly participation | ≥ 50% |

## Where to record

Admin UI: `/admin/signal` → **Expansion gate scoreboard** (`ExpansionGatesCard`).

- Live fresh-coverage % pre-fills from `/api/admin/fresh-coverage`.
- Operators enter conversion / retention / mismatch / scout % each ISO week (Mon start).
- Streak resets when any gate fails.
- Pure logic: `src/lib/expansion-gates.ts`.

## Working rhythm

- **Weekly (Mon):** record prior Thu–Sat week.
- **Before nightlife peak (Thu):** golden-path bug bash + stale neighborhood queue.
- **Expand only when** badge shows `8/8 clear`.

Related: [SEATTLE_BETA_BACKLOG.md](./SEATTLE_BETA_BACKLOG.md), [PRD-v1.0-SEATTLE-MVP.md](./PRD-v1.0-SEATTLE-MVP.md).
