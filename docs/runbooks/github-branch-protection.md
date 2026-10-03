# Runbook: GitHub branch protection for `main`

## Purpose

Human-only GitHub UI for issue **#65**. Agents cannot change required checks.
Pulse CI is venue+map only. Signal job names must not stay required.

## Preconditions

- Admin or maintain access on `hondoentertainment/pulse`
- Latest `main` includes `.github/workflows/ci.yml` with `smoke-preview-venue` and alias `smoke-preview`

## Procedure (exact clicks)

1. Open https://github.com/hondoentertainment/pulse
2. Click **Settings** (repo settings, not your user settings)
3. In the left sidebar, click **Rules** → **Rulesets**  
   If the repo still uses classic protection: left sidebar **Branches**
4. Classic path:
   1. Under **Branch protection rules**, click **main** (or **Add rule** if none exists)
   2. Check **Require status checks to pass before merging**
   3. Check **Require branches to be up to date before merging** (optional)
   4. In **Status checks that are required**, search and add:
      - `smoke-preview`
      - `smoke-preview-venue`
   5. In the same required-check list, click the **X** on any of:
      - `smoke-preview-signal`
      - `e2e-signal`
      - any other `*signal*` check name
   6. Solo maintainer: either
      - uncheck **Require a pull request before merging**, or
      - keep PRs required but set **Required approvals** to **0**, and/or
      - check **Allow specified actors to bypass required pull requests** and add yourself
   7. Click **Save changes**
5. Rulesets path (newer UI):
   1. Open the ruleset that targets `main`
   2. Under **Require status checks to pass**, add `smoke-preview` and `smoke-preview-venue`
   3. Remove `smoke-preview-signal` / `e2e-signal`
   4. Under **Bypass list** or pull-request requirements, allow the owner to merge their own PR
   5. Click **Save changes**

## Verification

- [ ] Opening a PR shows required checks `smoke-preview` and/or `smoke-preview-venue`
- [ ] No required check is named `smoke-preview-signal` or `e2e-signal`
- [ ] The repo owner can merge their own PR (admin bypass or 0 required reviews)

## Rollback / Escalation

If a required check name is misspelled, GitHub will block every PR. Remove the unknown check name immediately.

## Ownership

- Owner: repo admin on `hondoentertainment/pulse`
- Last reviewed: 2026-09-10
- Tracks: #65
