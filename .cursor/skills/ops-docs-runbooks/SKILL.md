---
name: ops-docs-runbooks
description: Keep operational documentation current with concise runbooks, checklists, and ownership notes. Use when the user asks to document workflows, create runbooks, reduce tribal knowledge, or improve onboarding for operations.
---

# Ops Docs Runbooks

## Goal
Convert recurring operations into short, reliable runbooks that new contributors can execute.

## When to Apply
- User asks to document setup, release, incident, or maintenance workflows
- Repeated Slack/issue questions indicate undocumented process
- New operational steps were added during implementation

## Runbook Standard
Each runbook should include:
1. Purpose and trigger
2. Preconditions and required access
3. Step-by-step execution commands
4. Verification checkpoints
5. Rollback/failure handling
6. Owner and update cadence

## Writing Rules
- Keep steps atomic and copy-paste friendly.
- Use exact commands and expected outputs where helpful.
- Include "stop conditions" when to escalate.
- Link to source artifacts (scripts, config files, dashboards).

## Output Template
```markdown
# <Runbook title>

## Purpose
...

## Preconditions
- ...

## Procedure
1. ...
2. ...

## Verification
- [ ] ...

## Rollback / Escalation
- ...

## Ownership
- Owner: ...
- Last reviewed: YYYY-MM-DD
```

## Guardrails
- Favor clarity over completeness; optimize for first-time executor success.
- Update docs in same change when process behavior changes.
