---
name: ops-intake-triage
description: Classify incoming work by urgency, impact, and effort, then produce an execution-ready queue. Use when the user asks to triage tasks, prioritize backlog items, plan upcoming work, or turn rough requests into clear implementation tickets.
---

# Ops Intake Triage

## Goal
Turn ambiguous or mixed requests into an ordered, execution-ready queue with clear acceptance criteria.

## When to Apply
- User asks to prioritize features, bugs, chores, or roadmap items
- User asks "what should we do next?" or "what is most important now?"
- Multiple requests arrive at once and need sequencing

## Workflow
1. Collect all candidate items from the user request and project context.
2. Score each item:
   - Urgency: `P0` blocker, `P1` high, `P2` normal, `P3` low
   - Impact: user-facing, stability, security, developer velocity
   - Effort: `S` (<0.5 day), `M` (0.5-2 days), `L` (2-5 days), `XL` (>5 days)
3. Flag dependencies and ordering constraints.
4. Convert top items into implementation-ready tickets with:
   - Problem statement
   - Scope (in/out)
   - Acceptance criteria
   - Verification steps
5. Produce an ordered queue and recommend next action.

## Prioritization Rules
- Always prioritize reliability and data-loss/security risks over feature polish.
- Prefer high-impact, low-effort items when urgency is tied.
- Split `L`/`XL` items into milestones before scheduling.
- If requirements are unclear, add a discovery task before implementation.

## Output Template
Use this structure:

```markdown
## Intake Summary
- Total items: X
- Recommended next action: <item id + why>

## Prioritized Queue
1. [ID] <title> — Priority: P1 | Effort: M | Impact: High
   - Why now: ...
   - Dependencies: ...
   - Acceptance criteria:
     - [ ] ...
     - [ ] ...
   - Verification:
     - ...
```

## Guardrails
- Do not invent requirements that are not stated or inferable.
- Call out assumptions explicitly.
- Keep final queue actionable for immediate execution.
