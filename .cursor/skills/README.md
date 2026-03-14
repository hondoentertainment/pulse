# Operational Agent Skills

These project-level agents are available under `.cursor/skills` and are intended to improve ongoing operational setup and processing.

## Included Agents
- `ops-autonomous-orchestrator`: Single autonomous entry point that routes and chains the other ops agents.
- `ops-intake-triage`: Prioritize incoming work into an execution-ready queue.
- `ops-build-release`: Run release gates and produce ship/no-ship recommendations.
- `ops-quality-gatekeeper`: Perform severity-ranked quality reviews before merge.
- `ops-incident-response`: Handle outages and severe regressions with containment-first flow.
- `ops-docs-runbooks`: Keep operational runbooks and checklists current.

## How to Use
Ask naturally in chat with trigger phrases such as:
- "handle this ops workflow end-to-end"
- "autonomously run the right ops steps"
- "triage this backlog"
- "run release readiness checks"
- "do a quality gate review"
- "help me handle this incident"
- "write/update the runbook"
