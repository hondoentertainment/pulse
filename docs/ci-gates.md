# CI gates

Enforced by `.github/workflows/ci.yml` on every push/PR to `main`/`master`.

The goal is a **regression-resistant baseline**: catch bad code before
merge, without over-fitting to the current state of the app.

## What's enforced

| Gate           | Job step               | Fails CI when                                             | Config location                    |
| -------------- | ---------------------- | --------------------------------------------------------- | ---------------------------------- |
| Lint errors    | `Lint`                 | Any ESLint error.                                         | `eslint.config.js`                 |
| Lint warnings  | `Lint`                 | More than 500 warnings (regression guard).                | `package.json` → `lint` script     |
| Unit tests     | `Unit Tests ...`       | Any test fails.                                           | `vite.config.ts` → `test`          |
| Coverage       | `Unit Tests ...`       | Coverage on `src/lib/**` falls below per-metric floors (stmts 35%, branches 33%, funcs 42%, lines 34%). | `vite.config.ts` → `test.coverage` |
| Build          | `Build`                | `bun run build` exits non-zero.                           | —                                  |
| Bundle size    | `Bundle-size budget`   | Any JS chunk (or the total) exceeds its gzip budget.      | `scripts/check-bundle-size.mjs`, `docs/bundle-budget.md` |
| Smoke tests    | `Smoke Tests`          | Playwright smoke scenarios fail.                          | `playwright.config.ts`             |

All gates are hard-fail: no `continue-on-error: true`.

## Coverage thresholds

Currently scoped to `src/lib/**` only — our best-tested area. Components
and hooks will join in a later wave once more component-level tests land.

Starting thresholds (see `vite.config.ts`). Numbers are set ~2% below
current observed coverage so a small refactor won't trip the gate, but
any meaningful drop will:

- statements: **35%** (today: ~37.5%)
- branches:   **33%** (today: ~35.7%)
- functions:  **42%** (today: ~44.7%)
- lines:      **34%** (today: ~36.6%)

TODO (tracked in config): raise to 50%+ once more lib modules gain tests,
then 70% steady-state. `thresholdAutoUpdate` is **off** so passing runs
never quietly ratchet the threshold.

Reporters: `text` (console summary), `lcov` (for codecov/coverage viewers),
and `json-summary` (machine-parseable). The raw `coverage/` directory is
uploaded as a CI artifact named `coverage`.

## Bundle-size budget

See [`bundle-budget.md`](./bundle-budget.md) for per-chunk limits and the
raise/tighten procedures. Violations dump a diagnostic report to the CI
log so a reviewer can see exactly which chunk is over and by how much.

## Lint warning cap

Lint runs with `--max-warnings=500`. Current baseline is ~255 warnings
(mostly `no-explicit-any` remnants and a handful of `react-refresh`
fast-refresh notes). The cap is set above today's count as a **ceiling**
— if warnings start creeping upward the CI will block merge before they
balloon further. Target is to keep pushing the number down.

## How to update thresholds

### Raise coverage thresholds (normal growth)

1. Run `bun run test:coverage` locally, note the real numbers.
2. Edit `vite.config.ts` under `test.coverage.thresholds`, bump each
   field to roughly current - 2% (leave a little slack for flaky edges).
3. Commit with a message like `chore(ci): raise coverage threshold to 50%`.

### Lower coverage thresholds (emergency)

If a legitimate refactor drops coverage temporarily, you may lower the
thresholds — but call it out in the PR description, file a follow-up
ticket to raise them back, and make sure the drop is genuinely temporary.
**Do not** drop thresholds as a reflex to unblock a PR that simply lacks
tests.

### Bundle budgets

See `docs/bundle-budget.md`. Same philosophy as coverage: raising is
allowed in an emergency with justification; tightening happens on a
cadence once a chunk is consistently under budget.

## Bypass in true emergencies

There is no `--no-verify` bypass in the workflow. To bypass a gate
temporarily you have three options, in order of preference:

1. **Fix the issue.** Usually faster than you think.
2. **Adjust the budget / threshold** in config. Justify in the PR and
   open a ticket to restore.
3. **Revert the gate step** in `.github/workflows/ci.yml`. Do **not**
   leave this state sitting — reintroduce the step in the next PR.

Never silently delete a budget or threshold to make CI pass. Every
bypass should be reviewable in `git log`.

## Local equivalent

You can run the same gates locally before pushing:

```bash
bun run lint
bun run test:coverage
bun run build
bun run bundle-size
```

`bun run release-check` chains lint + test + build + npm audit (the
npm-audit piece is separate from CI's coverage/bundle gates).
