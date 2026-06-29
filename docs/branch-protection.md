# GitHub branch protection (recommended)

Configure in **Settings → Branches → Branch protection rules** for `main`:

## Required status checks

| Check | Workflow job | Required for merge |
|-------|----------------|-------------------|
| Lint | `lint` | Yes |
| Unit tests + coverage | `test` | Yes |
| Build | `build` | Yes |
| Bundle size + PWA precache | `bundle-size` | Yes |
| Signal smoke E2E | `smoke-preview` | Yes |
| Signal tab navigation | `e2e-signal` | Yes |
| Lighthouse + perf budget (PRs only) | `lighthouse` | Yes (PRs) |
| TypeScript strict | `typecheck-strict` | Advisory (`continue-on-error`) |
| Dependency audit | `dependency-audit` | Advisory (`continue-on-error`) |

Also enable:

- **Require branches to be up to date** before merging
- **Require pull request reviews** (at least 1)
- **Do not allow bypassing** for admins (optional but recommended pre-launch)

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
  --field required_status_checks[contexts][]=lighthouse \
  --field enforce_admins=true \
  --field required_pull_request_reviews[required_approving_review_count]=1
```

Replace `{owner}/{repo}` with your GitHub slug.
