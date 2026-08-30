# GitHub branch protection (`main`)

Configure in **Settings → Branches → Branch protection rules** for `main`.

This agent cannot change protection (no admin API). A solo maintainer also cannot approve their own PR.

## Required status checks

Prefer the shipping Signal jobs. Do **not** require the legacy single name `smoke-preview` unless the alias job in `.github/workflows/ci.yml` is present (it is — it needs `smoke-preview-signal`).

| Check | Workflow job | Notes |
|-------|----------------|-------|
| Lint | `lint` | Required |
| Unit tests + coverage | `test` | Required |
| Build | `build` | Required |
| Bundle size | `bundle-size` | Optional — Lighthouse JS budget is noisy |
| Signal smoke | `smoke-preview` **or** `smoke-preview-signal` | Required. The `smoke-preview` job is an alias so stale protection stays green |
| Signal E2E | `e2e-signal` | Recommended |
| Venue smoke | `smoke-preview-venue` | Advisory only (`continue-on-error`) |
| TypeScript strict | `typecheck-strict` | Advisory — legacy venue errors |
| Dependency audit | `dependency-audit` | Advisory |

## Solo-maintainer clicks

1. GitHub repo → **Settings** → **Branches** → rule on `main`.
2. **Require status checks to pass** → search `smoke-preview` (alias) or replace it with `smoke-preview-signal`. Remove any required check that no longer exists as a job name.
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
  --field required_status_checks[contexts][]=e2e-signal \
  --field enforce_admins=false \
  --field required_pull_request_reviews[required_approving_review_count]=0
```

## Ownership

- Owner: repository admin
- Last reviewed: 2026-08-30
