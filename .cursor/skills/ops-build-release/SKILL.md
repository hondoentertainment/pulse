---
name: ops-build-release
description: Run and harden build, test, and release operations for this repository. Use when the user asks to validate readiness, run release checks, create release checklists, or improve deployment reliability.
---

# Ops Build Release

## Goal
Provide repeatable pre-release operations that reduce broken builds and regressions.

## When to Apply
- User asks to prepare a release or deploy safely
- User asks to verify project health before merge
- User asks for CI/readiness checks or release runbooks

## Standard Command Set
Run in repository root:

```bash
npm run lint
npm run test
npm run build
```

If a command fails:
1. Capture root cause
2. Propose smallest safe fix
3. Re-run failed step and dependent steps

## Release Readiness Workflow
1. Confirm branch cleanliness and expected diff scope.
2. Run lint, tests, and build in order.
3. Validate env/config assumptions for deployment target.
4. Summarize pass/fail gates.
5. Generate ship/no-ship recommendation with risks.

## Output Template
```markdown
## Release Check
- Lint: pass/fail
- Tests: pass/fail
- Build: pass/fail

## Risks
- <risk + impact + mitigation>

## Recommendation
- Ship / No-ship
- Required follow-ups:
  - [ ] ...
```

## Guardrails
- Never claim a gate passed without actually running it.
- If tests are missing, call that out as a release risk.
- Prefer additive fixes; avoid risky refactors in release windows.
