# GitHub Workflows

CI/CD pipelines in `.github/workflows/`. All workflows use Node.js 20 unless noted.

---

## Overview

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI** | `ci.yml` | Push/PR to `main` | Lint, test, build, bundle-size, smoke, lighthouse (PR), audit |
| **Deploy** | `deploy.yml` | Manual dispatch | Vercel preview + optional production |
| **Lighthouse CI** | `lighthouse.yml` | PR to `main` | Performance, a11y, bundle budget |
| **Native Sync** | `native-sync.yml` | Tag `native-*` / manual | Capacitor sync artifact |

---

## CI (`ci.yml`)

Runs on every push and pull request to `main`/`master`.

### Jobs

| Job | Timeout | Steps | Notes |
|-----|---------|-------|-------|
| `lint` | 10 min | `npm ci` → `npm run lint` | ESLint, max 500 warnings |
| `test` | 10 min | `npm ci` → `npm run test` | Vitest unit suite |
| `build` | 15 min | `npm ci` → `npm run build` | TypeScript + Vite production build |
| `bundle-size` | 15 min | build + `npm run bundle-size` | JS gzip + PWA precache budgets |
| `smoke-preview` | 20 min | Playwright Signal smoke | `VITE_E2E_AUTH_BYPASS=true` |
| `e2e-signal` | 20 min | Signal tab navigation E2E | Hard fail |
| `typecheck-strict` | 15 min | `npx tsc -b` | Advisory (`continue-on-error`) |
| `lighthouse` | 20 min | build + Lighthouse CI + bundle-size | PRs only; hard fail |
| `dependency-audit` | 10 min | `npm audit --audit-level=high` | Advisory (`continue-on-error`) |

### Concurrency

```yaml
group: ci-${{ github.workflow }}-${{ github.ref }}
cancel-in-progress: true
```

In-flight CI on the same branch is cancelled when a new push arrives.

### Artifacts

| Name | Contents |
|------|----------|
| `playwright-report` | HTML report + test-results |
| `npm-audit-report` | `audit-report.json` |

Details: [CI Gates](ci-gates.md).

---

## Deploy (`deploy.yml`)

Manual workflow — GitHub Actions → Deploy → Run workflow.

### Inputs

| Input | Options | Default |
|-------|---------|---------|
| `target` | `preview`, `production` | `preview` |

### Jobs

```
quality_gate
    ├── npm run build
    └── npm run test:smoke
        │
        ▼
deploy_preview (always)
    ├── vercel pull --environment=preview
    ├── vercel build
    └── vercel deploy --prebuilt
        │
        ▼
deploy_production (if target=production)
    ├── vercel pull --environment=production
    ├── vercel build --prod
    └── vercel deploy --prebuilt --prod
```

### Required secrets

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel team/org ID |
| `VERCEL_PROJECT_ID` | Linked project ID |

### Concurrency

```yaml
group: deploy-${{ github.ref }}
cancel-in-progress: false
```

Deploys are never cancelled mid-flight.

Full deploy guide: [Deployment Guide](deployment.md).

---

## Lighthouse CI (`lighthouse.yml`)

Runs on pull requests to `main`/`master`.

### Steps

1. `npm ci` + `npm run build`
2. Install `serve` globally
3. Run `treosh/lighthouse-ci-action@v12` with `lighthouserc.json`
4. Check total JS bundle ≤ 1500 KB
5. Report per-chunk breakdown in GitHub step summary

### Config

`lighthouserc.json` defines URL targets and assertion thresholds for:
- Performance
- Accessibility
- Best practices
- SEO

---

## Native Sync (`native-sync.yml`)

Runs on tags matching `native-*` or manual dispatch.

### Purpose

Verifies `cap sync` succeeds after a web build. Does **not** compile native apps (requires macOS/Xcode for iOS).

### Steps

1. `bun install --frozen-lockfile`
2. `bun run build`
3. `bunx cap sync` (continue-on-error if native projects not committed)
4. Upload artifact: `dist/`, `ios/`, `android/`, `capacitor.config.ts`

Retention: 14 days.

---

## Required GitHub branch protection

Recommended for `main`:

| Required check | Source job |
|----------------|------------|
| Lint | `ci.yml` → `lint` |
| Test | `ci.yml` → `test` |
| Build | `ci.yml` → `build` |

Optional but recommended:
- `smoke-preview`
- Lighthouse CI on PRs

See [RELEASE_CHECKS.md](../RELEASE_CHECKS.md).

---

## Local CI simulation

```bash
npm run release-check          # lint + test + build + audit
npm run test:smoke             # E2E against preview
node scripts/check-bundle-size.mjs   # bundle budget
```

---

## Adding a new workflow

1. Create `.github/workflows/my-workflow.yml`
2. Use `actions/checkout@v4` + `actions/setup-node@v4` with `node-version: 20`
3. Run `npm ci` (not `npm install`) for reproducible builds
4. Document the workflow in this file
5. Add required checks to branch protection if blocking

---

## Related docs

- [CI Gates](ci-gates.md)
- [Deployment Guide](deployment.md)
- [Testing Guide](testing.md)
- [Bundle Budget](bundle-budget.md)
