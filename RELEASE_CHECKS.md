# Release Checks

This document defines the minimum checks to run before deploying Pulse from the current repository state.

## Automated Checks

Run these locally before shipping:

```bash
npm run lint
npm run test
npm run build
npm run test:smoke
```

Expected result:
- Lint completes without errors
- Tests pass
- Build succeeds
- Browser smoke checks pass against a preview build

## Manual Smoke Checks

Before a production deployment, verify these flows in the app:

1. Open the app and confirm the main shell loads without crashing.
2. Open the map tab and verify venues render, panning works, and venue preview cards appear.
3. Open a venue page and confirm score, metadata, and pulse activity render.
4. Open pulse creation and verify the dialog opens and basic submission flow still works.
5. Open notifications and profile pages and confirm they load without runtime errors.
6. Confirm onboarding does not regress for a fresh session.

## Deploy Readiness Notes

Current caveats:
- This app still deploys prototype data and client-managed state.
- Passing release checks does not mean the product is fully production-grade.
- The deploy should still be treated as a controlled prototype release until backend, auth, and observability work are complete.

## Recommended GitHub Required Checks

Configure these workflow checks as required on the default branch (see
[`docs/branch-protection.md`](docs/branch-protection.md) for the full table
and a `gh` CLI snippet):

- `lint`
- `test`
- `build`
- `bundle-size`
- `typecheck-strict`
- `smoke-preview`
- `e2e-signal`

The workflow also runs these advisory (`continue-on-error`) jobs — surface
debt without keeping every PR red, so **do not** mark them required:

- `smoke-preview-venue`
  Playwright venue-mode smoke against a preview build; uploads the HTML report.
- `dependency-audit`
  Uploads `npm audit --audit-level=high` output as an artifact.

Notes on the smoke jobs:

- The suite is split by app mode — `smoke-preview-signal` (blocking) and
  `smoke-preview-venue` (advisory). The `smoke-preview` required context is
  produced by an aggregator job that gates on `smoke-preview-signal`; keep it
  in sync if the smoke jobs are renamed. `lighthouse.yml` also runs on PRs
  (perf assertions are warnings) and enforces the gzip bundle budget via
  `npm run bundle-size`.

## Next Check To Harden

The next automation gap to close is expanding browser smoke coverage for the critical path:

- onboarding
- map interaction
- venue open
- pulse creation
- notifications
