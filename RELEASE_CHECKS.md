# Release Checks

This document defines the checks to run before deploying Pulse from the current repository state.

## Quick Reference

```bash
# Run all automated checks in one command
npm run release-check
```

This executes: lint → test → build → audit

## Automated Checks

### 1. Lint

```bash
npm run lint
```

**Pass criteria:** Zero errors. Warnings are acceptable but should trend downward over time.

### 2. Unit Tests

```bash
npm run test
```

**Pass criteria:** All tests pass. No skipped tests without a tracking issue.

### 3. Build

```bash
npm run build
```

**Pass criteria:** Build succeeds. TypeScript type-checking passes. Review any new chunk size warnings — the `react-vendor` chunk is currently ~672 KB (above the 600 KB warning threshold).

### 4. Dependency Audit

```bash
npm run audit
```

**Pass criteria:** No high or critical severity vulnerabilities. If a vulnerability exists in a transitive dependency with no available fix, document it and file an issue.

### 5. Smoke Tests (when available)

```bash
npm run test:smoke
```

**Pass criteria:** All Playwright smoke tests pass against a local preview build.

## Manual Smoke Checks

Before a production deployment, verify these flows in a browser:

| # | Flow | What to Check |
|---|------|--------------|
| 1 | **App Load** | Main shell loads without console errors |
| 2 | **Map Tab** | Venues render, panning works, preview cards appear on pin tap |
| 3 | **Venue Page** | Score, metadata, pulse activity, and stories render |
| 4 | **Pulse Creation** | Dialog opens, energy slider works, submission succeeds |
| 5 | **Discover/Trending** | Lists populate with venue cards, categories render |
| 6 | **Notifications** | Notification feed loads, unread indicators display |
| 7 | **Profile** | User profile renders, settings accessible |
| 8 | **Onboarding** | Fresh session shows onboarding flow correctly |
| 9 | **Search** | Global search opens, returns results, navigates to venue |
| 10 | **Offline** | App shows offline indicator when disconnected, queues actions |

## Pre-Deploy Checklist

- [ ] `npm run release-check` passes
- [ ] Manual smoke checks completed on a preview build (`npm run preview`)
- [ ] No unmerged dependency PRs with security fixes
- [ ] Recent commits reviewed — no debug code, console.logs, or TODO hacks
- [ ] Bundle size has not regressed significantly (check build output)

## Post-Deploy Verification

After deploying to production:

- [ ] App loads at the production URL
- [ ] Sentry is receiving events (check Sentry dashboard)
- [ ] Lighthouse CI scores have not regressed
- [ ] No new error spikes in monitoring

## GitHub Required Checks

Configure these workflow jobs as required status checks on the default branch:

- `lint`
- `test`
- `build`

## Known Caveats

- This app still deploys prototype data and client-managed state
- Passing release checks does not mean the product is fully production-grade
- The deploy should be treated as a controlled prototype release until backend, auth, and observability work are complete (see [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md))

## Next Checks to Add

1. **E2E smoke coverage** for critical path flows (onboarding → map → venue → pulse creation)
2. **Bundle size budget** enforcement in CI
3. **Lighthouse performance threshold** as a required check
4. **Visual regression testing** for key UI states
