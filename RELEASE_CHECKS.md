# Release Checks

This document defines the minimum checks to run before deploying Pulse from the current repository state.

## Automated Checks

Run these locally before shipping:

```bash
npm run lint
npm run test
npm run build
```

Expected result:
- Lint completes without errors
- Tests pass
- Build succeeds

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

Configure these workflow checks as required on the default branch:

- `lint`
- `test`
- `build`

## Next Check To Add

The next automation gap to close is browser-level smoke coverage for the critical path:

- onboarding
- map interaction
- venue open
- pulse creation
- notifications
