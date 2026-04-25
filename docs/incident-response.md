# Pulse Incident Response

This document is the canonical playbook for incidents affecting Pulse
production. It covers severity levels, escalation, communications, and
post-mortem expectations. For day-two observability tooling see
[`observability.md`](./observability.md).

---

## 1. Severity Matrix

| Sev   | Definition                                                                                      | Examples                                                                                             | Target response | Target mitigation |
| ----- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------- | ----------------- |
| Sev 1 | Full outage or data loss risk. Core loop unusable for > 5% of users.                            | App shell fails to load; auth broken; Supabase writes failing; privacy leak.                         | 5 min           | 60 min            |
| Sev 2 | Partial outage. A major feature is broken but the app still loads and the core loop works.     | Pulse creation works but venues do not load; map broken; push notifications silent.                  | 15 min          | 4 h               |
| Sev 3 | Minor feature broken, no impact on the core loop. Cosmetic / perf regression affecting few.    | Broken badge art; dev console spam; one city's venue list stale; p95 LCP regressed but still good.   | 1 business day  | 5 business days   |
| Sev 4 | Internal-only or pre-prod issue. No user impact.                                                | Flaky CI test; staging env stuck; stale dashboard.                                                   | Best effort     | Best effort       |

### Declaring severity

The on-call engineer declares severity within the first 5 minutes of
triage. When in doubt, declare **higher** and downgrade later — a Sev 2
that turns out to be Sev 3 costs little; the reverse is expensive.

---

## 2. Roles

| Role                  | Who                                  | Responsibility                                                                                     |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Incident Commander    | On-call engineer (primary)           | Drives the incident. Declares severity, owns decisions, times the clock, decides when to resolve. |
| Ops Lead              | On-call engineer (secondary) or IC   | Runs mitigation, rollbacks, infra toggles.                                                         |
| Comms Lead            | PM on-call, falls back to IC         | Status page, customer support, exec updates, social.                                               |
| Scribe                | Volunteer or comms lead              | Maintains the running timeline in the incident doc.                                                |
| Subject Matter Expert | Paged in as needed                   | Domain knowledge for the impacted area.                                                            |

For Sev 1 and Sev 2, the IC and Comms Lead should be different people.
For Sev 3 one person can cover multiple roles.

---

## 3. Escalation

Escalation ladder — move to the next rung after 15 minutes without
meaningful progress, or immediately if the incident widens.

1. On-call primary (PagerDuty rotation `pulse-primary`)
2. On-call secondary (PagerDuty rotation `pulse-secondary`)
3. Engineering lead
4. Head of Engineering
5. CTO (Sev 1 only)

Vendor escalation paths to keep handy:

- **Vercel**: dashboard > Support. Enterprise hotline for Sev 1.
- **Supabase**: dashboard > Support. Paid tier chat for Sev 1.
- **Sentry**: email support; rarely on the critical path.
- **Mapbox**: account dashboard > Support; impacts map tiles.

---

## 4. Incident Lifecycle

### 4.1 Detect
Sources:
- PagerDuty alert (Sentry, uptime probe, log-based alert)
- Customer report via support queue
- Internal report in `#pulse-bugs`

### 4.2 Triage (first 5 minutes)
- Acknowledge the page.
- Open Sentry, Vercel, Supabase, uptime dashboard.
- Determine blast radius: single user / feature / region / global.
- Declare severity in `#pulse-incidents`.
- Spin up incident doc from the template (section 7).

### 4.3 Mitigate
Prefer mitigation over root-cause fixes during an active incident.
Options, in rough order of reach-for-first:

1. **Rollback** — `vercel rollback` to the last known-good deploy.
2. **Feature flag off** — disable the suspect surface via
   `src/lib/feature-flags.ts`.
3. **Cache lengthen** — extend client cache TTL so stale data keeps
   the UI alive while upstream recovers.
4. **Rate-limit dial** — tighten client-side rate limits to shed load.
5. **Static fallback** — if the app shell is fine, leave the PWA
   service-worker cached content in place while fixing upstream.

### 4.4 Communicate
See templates in section 5. Minimum cadence:

- Sev 1: status page within 15 min, updates every 30 min.
- Sev 2: status page within 30 min, updates every 60 min.
- Sev 3: ticket updates every 4 h during business hours.

### 4.5 Recover
- Verify mitigation with synthetic monitoring and a manual smoke test.
- Watch error rate for 15 min after "resolved" is declared.
- Mark the status page resolved with a summary sentence.

### 4.6 Review
- Post-mortem doc opened within 24 h.
- Review meeting within 5 business days.
- Action items filed and tagged `post-incident` with owners + due dates.

---

## 5. Communications Templates

### 5.1 Initial status-page post

```
[Investigating] <short, user-facing description>

<Date, time zone>

We are investigating reports of <symptom>. Some users may experience
<impact>. We will post the next update by <now + 30 min>.
```

### 5.2 Investigating → Identified

```
[Identified] <short, user-facing description>

<Date, time zone>

We have identified the cause as <one-sentence description, no internal
names>. A fix is rolling out. Next update by <now + 30 min>.
```

### 5.3 Resolved

```
[Resolved] <short, user-facing description>

<Date, time zone>

The issue has been resolved. The root cause was <one-sentence, still
user-facing>. A post-mortem will be posted within 5 business days.
```

### 5.4 Internal Slack kickoff

```
:rotating_light: Sev <N> declared: <title>
IC: @<name>
Comms: @<name>
Incident doc: <link>
War room: <thread link>
Symptom: <one line>
Current blast radius: <users / features / regions>
```

### 5.5 Customer support macro

```
Thanks for reporting this — we're aware of the issue and are actively
working on a fix. You can follow updates at status.pulse.app. We will
follow up in this thread once it is resolved.
```

---

## 6. Post-Mortem Template

Create one document per incident in `docs/post-mortems/<YYYY-MM-DD>-<slug>.md`.

```markdown
# Post-Mortem: <title>

- **Date:** <YYYY-MM-DD>
- **Severity:** Sev <N>
- **Duration:** <start time> – <end time> (<total minutes>)
- **Incident commander:** <name>
- **Authors:** <names>
- **Status:** Draft | Reviewed | Published

## Summary

One paragraph. What happened, who was affected, how we fixed it.

## Impact

- Users affected: <count or %>
- Features affected: <list>
- Revenue impact: <estimate or "none">
- SLA / SLO burn: <yes/no + how much>

## Timeline (UTC)

- `hh:mm` — First alert from <source>.
- `hh:mm` — IC acknowledged; Sev <N> declared.
- `hh:mm` — <mitigation attempted>.
- `hh:mm` — Mitigation verified.
- `hh:mm` — Status page marked Resolved.

## Root Cause

Narrative. Include the specific change, config, or condition that
caused the incident. Link the offending commit / deploy / ticket.

## Trigger

What specifically pushed the latent cause into a user-visible failure?
(e.g. the deploy at 14:03, the Supabase upgrade, the traffic spike.)

## Detection

- How did we find out?
- How long from onset to page?
- What could make detection faster next time?

## Response

- What went well?
- What was slow or missing?
- Were the right people paged?
- Were the runbooks correct?

## Resolution

What actually fixed it? Was the fix clean or a workaround?

## Lessons Learned

Three to five bullets. Focus on systemic issues, not individuals.

## Action Items

| Owner     | Action                                          | Type        | Due        |
| --------- | ----------------------------------------------- | ----------- | ---------- |
| @alice    | Add alert on `<metric>`                         | Detection   | YYYY-MM-DD |
| @bob      | Add rollback-on-red to CI                       | Prevention  | YYYY-MM-DD |
| @carol    | Document feature-flag kill switch in README     | Docs        | YYYY-MM-DD |

## Supporting Material

- Incident doc: <link>
- Sentry issue: <link>
- Deploys involved: <links>
- Graphs: <links or screenshots>
```

---

## 7. Live Incident Doc Template

Use this while the incident is running. Copy it into a fresh Google
Doc / Notion page before declaring.

```markdown
# Incident: <title>

- Sev: <N>
- Started: <UTC timestamp>
- IC: <name>
- Comms: <name>
- War room: <thread link>
- Status-page incident: <link>

## Current status

<Updated in place. One paragraph max.>

## Timeline

- `hh:mm` — ...

## Hypotheses

- [ ] <candidate cause>
- [ ] <candidate cause>

## Actions taken

- `hh:mm` — @<name> did <thing>. Result: <outcome>.

## Decisions

- `hh:mm` — Decided to <thing> because <reason>. Owner: @<name>.

## Follow-ups (to file after resolution)

- [ ] ...
```

---

## 8. On-call Expectations

- Acknowledge pages within 5 minutes, 24/7 during the on-call shift.
- Be reachable (phone on, laptop within 15 min).
- No deploys in the last 2 hours of a shift unless the on-call is also
  reachable through the handoff.
- Write a short handoff note at the end of every shift listing any open
  incidents, flaky alerts, or known-fragile areas.

### Handoff template

```
Shift: <start> -> <end>
Incidents this shift: <count>, links: <...>
Open action items: <...>
Known fragile areas: <...>
Alert noise to tune: <...>
```

---

## 9. Drills

- Run a game-day exercise quarterly. Rotate scenarios:
  - Vercel outage
  - Supabase read-replica lag
  - Mapbox tile outage
  - Supabase auth misconfigured
  - Deploy rollback drill
- After each drill, update this doc with anything that was wrong or
  missing.
