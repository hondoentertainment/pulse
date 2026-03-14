---
name: ops-autonomous-orchestrator
description: Autonomously route operational requests to the right workflow and chain multiple ops skills when needed. Use when the user asks for end-to-end operations handling, autonomous execution, or a single agent to manage triage, quality, release, incident, and documentation steps.
---

# Ops Autonomous Orchestrator

## Goal
Provide one entry point that can execute operational workflows with minimal user back-and-forth.

## When to Apply
- User asks for autonomous ops handling
- User asks for "run this end-to-end" across multiple ops areas
- Request is ambiguous and could involve intake, quality, release, incident, and docs

## Routing Matrix
Map request intent to primary skill:
- Backlog prioritization, "what next", scoping -> `ops-intake-triage`
- Readiness checks, release, deployment confidence -> `ops-build-release`
- Review/audit/risk checks -> `ops-quality-gatekeeper`
- Outage/hotfix/rollback/severe bug -> `ops-incident-response`
- Runbooks/docs/onboarding steps -> `ops-docs-runbooks`

If a request spans multiple areas, chain them in this order unless incident response is active:
1. `ops-intake-triage`
2. `ops-quality-gatekeeper`
3. `ops-build-release`
4. `ops-docs-runbooks`

Incident override:
- If live production impact is detected, run `ops-incident-response` first.
- After stabilization, return to quality/release/docs as needed.

## Autonomous Execution Policy
1. Start execution immediately with best-fit routing.
2. Ask clarifying questions only if blocked by missing critical info.
3. Prefer safe, reversible changes.
4. Report progress after each major phase.
5. End with:
   - Decision (ship/no-ship, pass/fail, mitigated/unresolved)
   - Risks and follow-ups
   - Next recommended action

## Ambiguity Resolver
Use these defaults when intent is mixed:
- Mentions "urgent", "down", "broken in prod" -> incident-first path
- Mentions "before deploy", "release today" -> build-release path
- Mentions "review this change" -> quality gate path
- Mentions "organize work" -> intake path
- Mentions "document process" -> docs-runbook path

## Output Template
```markdown
## Orchestrator Plan
- Detected intent: ...
- Selected path: <single skill or chained skills>
- Why: ...

## Phase Results
1. <phase>
   - Outcome: ...
   - Risks: ...

## Final Decision
- Status: Pass / Conditional / Fail / Mitigated
- Required follow-ups:
  - [ ] ...
```

## Guardrails
- Do not skip validation gates when code changes are made.
- Do not claim completion without verification evidence.
- Keep recommendations actionable and ordered by risk.
