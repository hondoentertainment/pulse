# GitHub branch protection (recommended)

Configure in **Settings → Branches → Branch protection rules** for `main`:

## Required status checks

| Check | Workflow job | Notes |
|-------|----------------|-------|
| Lint | `lint` | |
| Unit tests + coverage | `test` | |
| Build | `build` | |
| Bundle size | `bundle-size` | |
| Smoke E2E (critical path) | `smoke-preview` | Aggregator context — see below |
| Signal E2E | `e2e-signal` | |
| TypeScript strict | `typecheck-strict` | |

> **The `smoke-preview` context.** The smoke suite is split into two jobs by
> app mode: `smoke-preview-signal` (blocking) and `smoke-preview-venue`
> (advisory — `continue-on-error: true`). Neither publishes a `smoke-preview`
> status, so a `smoke-preview` required check would sit permanently "expected"
> and block every merge. `ci.yml` therefore includes a `smoke-preview`
> aggregator job that republishes that context and fails unless
> `smoke-preview-signal` passed. Keep the aggregator if you keep `smoke-preview`
> in the required list — or drop `smoke-preview` from the list and require
> `smoke-preview-signal` directly.

> **Do not require `dependency-audit`.** It runs with `continue-on-error: true`
> (advisory: surfaces `npm audit` debt without keeping PRs red). Requiring it
> makes any new advisory a hard merge blocker, which defeats the intent — leave
> it out of the required set.

Also enable:

- **Require branches to be up to date** before merging
- **Require pull request reviews** (at least 1)
- **Do not allow bypassing** for admins (optional; recommended pre-launch).
  Note: with this on, even repo admins cannot use the merge-button override,
  so a solo owner must lower the review requirement to merge their own PR.

## CLI (requires `gh` admin access)

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=lint \
  --field required_status_checks[contexts][]=test \
  --field required_status_checks[contexts][]=build \
  --field required_status_checks[contexts][]=bundle-size \
  --field required_status_checks[contexts][]=smoke-preview \
  --field required_status_checks[contexts][]=e2e-signal \
  --field required_status_checks[contexts][]=typecheck-strict \
  --field enforce_admins=true \
  --field required_pull_request_reviews[required_approving_review_count]=1
```

Replace `{owner}/{repo}` with your GitHub slug.
