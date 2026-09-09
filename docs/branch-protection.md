# GitHub branch protection (`main`)

Configure in **Settings → Branches → Branch protection rules** for `main`.

This agent cannot change protection (no admin API). A solo maintainer also cannot approve their own PR.

## Required status checks

Prefer the shipping venue jobs. Do **not** require retired Signal job names (`smoke-preview-signal`, `e2e-signal`). The `smoke-preview` alias still exists and needs `smoke-preview-venue`.

| Check | Workflow job | Notes |
|-------|----------------|-------|
| Lint | `lint` | Required |
| Unit tests + coverage | `test` | Required |
| Build | `build` | Required |
| Bundle size | `bundle-size` | Optional — Lighthouse JS budget is noisy |
| Venue smoke | `smoke-preview` **or** `smoke-preview-venue` | Required. The `smoke-preview` job is an alias so stale protection stays green |
| TypeScript strict | `typecheck-strict` | Blocking on current `main` |
| Dependency audit | `dependency-audit` | Blocking on current `main` |

## Solo-maintainer clicks

1. GitHub repo → **Settings** → **Branches** → rule on `main`.
2. **Require status checks to pass** → search `smoke-preview` (alias) or `smoke-preview-venue`. Remove any required check that no longer exists as a job name (`smoke-preview-signal`, `e2e-signal`).
3. Either:
   - **Allow specified actors to bypass** (the owner), **or**
   - Set **Required approving reviews** to **0**
4. Keep “require branches to be up to date” if CI is green; turn it off only if stale required checks block merges.

Do not require admin-only reviews when the owner is the only collaborator — that combination made #61 unblockable from this agent.

## CLI (requires `gh` admin access)

```bash
gh api repos/hondoentertainment/pulse/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=lint \
  --field required_status_checks[contexts][]=test \
  --field required_status_checks[contexts][]=build \
  --field required_status_checks[contexts][]=smoke-preview \
  --field enforce_admins=false \
  --field required_pull_request_reviews[required_approving_review_count]=0
```

## Ownership

- Owner: repository admin
- Last reviewed: 2026-09-09
