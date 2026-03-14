---
name: ops-incident-response
description: Triage live issues, contain impact, and drive recovery with a structured incident workflow. Use when the user reports production failures, outages, severe bugs, rollback needs, or asks for a hotfix protocol.
---

# Ops Incident Response

## Goal
Stabilize quickly, minimize user impact, and document root cause with clear follow-up actions.

## When to Apply
- Outage, severe regression, or data integrity concern
- User asks for rollback/hotfix guidance
- Error spike or operational instability

## Incident Workflow
1. **Classify severity**
   - `SEV1`: outage/data loss/security exposure
   - `SEV2`: major feature broken for many users
   - `SEV3`: localized degradation or workaround exists
2. **Contain**
   - Disable risky path, rollback, or feature-flag off
   - Communicate current impact and workaround
3. **Diagnose**
   - Gather evidence (logs, failing flows, recent changes)
   - Form and test hypotheses in smallest safe steps
4. **Recover**
   - Apply hotfix/rollback
   - Verify with targeted checks
5. **Follow through**
   - Document root cause
   - Add prevention tasks (tests, alerts, guardrails)

## Communication Template
```markdown
## Incident Update
- Severity: SEV2
- User impact: ...
- Current status: Investigating / Mitigated / Resolved
- Containment in place: ...
- Next update ETA: ...
```

## Post-Incident Template
```markdown
## Postmortem
- Timeline:
- Root cause:
- Trigger:
- Resolution:
- Preventive actions:
  - [ ] ...
  - [ ] ...
```

## Guardrails
- Prefer reversible mitigation first.
- Never skip verification after mitigation.
- Keep updates brief, factual, and time-stamped.
