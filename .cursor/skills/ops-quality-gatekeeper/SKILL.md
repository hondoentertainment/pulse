---
name: ops-quality-gatekeeper
description: Review changes for regressions, edge cases, and missing validation before merge. Use when the user asks for a quality review, pre-merge gate, risk assessment, or confidence check on a feature.
---

# Ops Quality Gatekeeper

## Goal
Catch high-risk issues before code lands by enforcing practical quality gates.

## When to Apply
- User asks for review, audit, or readiness check
- Significant feature/refactor touched core flows
- Bug fixes need regression confidence

## Review Sequence
1. Understand scope: what changed and why.
2. Check behavioral correctness:
   - Happy path
   - Failure path
   - Edge cases
3. Check operational quality:
   - Error handling
   - Logging/observability impact
   - Performance hot spots
4. Check validation coverage:
   - Unit/component/integration tests
   - Manual verification gaps
5. Produce severity-ranked findings and remediation order.

## Severity Model
- `Critical`: data loss, security, hard crash, production blocker
- `High`: user-visible incorrect behavior, likely regression
- `Medium`: reliability or maintainability concern
- `Low`: polish or non-blocking cleanup

## Output Template
```markdown
## Findings (Highest severity first)
- [Critical|High|Medium|Low] <title>
  - Evidence: <file/symbol/behavior>
  - Risk: <impact>
  - Fix: <specific action>

## Residual Risk
- <known gap>

## Gate Decision
- Pass / Conditional Pass / Fail
```

## Guardrails
- Findings first, summary second.
- Do not block on style-only issues unless they create risk.
- If no issues found, state that explicitly and list testing gaps.
