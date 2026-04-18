# Chaos Drills

We run chaos drills to make sure the runbooks work, the alerts fire, and the people on call know what to do. Untested runbooks are not runbooks — they're fiction.

**Cadence:** one live drill per quarter, plus one tabletop per quarter. Four total exercises per year.

**Ground rules:**

- Announce the **window** (not the scenario) to the broader team 24 h ahead.
- Never run a destructive drill against production. Use staging or a branch.
- A drill passes if the runbook was followed end-to-end **and** the stated RTO / detection targets were met.
- A drill that surfaces a bug is a **successful** drill — file tickets, don't sweep.

## 1. Quarterly Schedule

| Quarter | Live drill | Tabletop |
|---------|-----------|----------|
| Q1 (Feb) | Deploy rollback drill | Moderation bypass |
| Q2 (May) | Supabase PITR restore drill | Traffic surge |
| Q3 (Aug) | Auth outage — graceful degradation | Data loss |
| Q4 (Nov) | Incident simulation (live, blind) | Deploy rollback |

Each drill produces an entry in the `ops-drills` Linear project with: scenario, duration, pass/fail, findings, follow-up tickets.

## 2. Drill: Deploy Rollback

**Goal:** prove we can roll back a bad prod deploy in < 5 min, by someone who did not do the original deploy.

**Pre-work (night before):**
- Pick a volunteer who is on-call next week.
- Prepare a "bad" commit on a feature branch that breaks `/api/pulses/create` (e.g. throws 500 unconditionally). Do **not** merge yet.

**Script:**

1. **T+0:** Merge the bad commit to `main` (or push it as an overriding deploy via `vercel --prod`).
2. Watch Sentry + synthetics for the first alert (expected within 5 min — if not, that's a finding).
3. Pager rings. Volunteer follows `runbooks/bad-deploy.md` from scratch.
4. **Measure:**
   - Time to first alert page.
   - Time from page to rollback promoted.
   - Whether the volunteer needed help to find the right Vercel screen.
5. Once rolled back, revert the bad commit in git and redeploy clean.

**Pass criteria:**
- Alert fires in ≤ 5 min.
- Rollback completes in ≤ 5 min from page.
- No un-runbooked steps were needed.

## 3. Drill: Supabase PITR Restore

**Goal:** prove a real restore works and meets RTO ≤ 30 min / RPO ≤ 1 min.

**Pre-work:**
- Schedule a 90-minute window.
- Ensure staging has recent, non-trivial data (seed + recent synthetic traffic).

**Script:**

1. Snapshot staging row counts and sample of known pulse IDs (save to the drill doc).
2. Intentionally delete rows:
   ```sql
   BEGIN;
   DELETE FROM pulses WHERE created_at > now() - interval '10 minutes';
   COMMIT;
   ```
3. **T+0:** follow `runbooks/data-loss.md` sections 2–5 to restore staging via **branch restore** back to T−5 min.
4. Run integrity queries (`runbooks/data-loss.md` section 5).
5. Compare restored row counts + sample IDs against the pre-drill snapshot.
6. Measure RTO (from "T+0 deletion" to "all integrity checks pass").

**Pass criteria:**
- RTO ≤ 30 min.
- All integrity checks pass.
- No rows other than the intentionally deleted ones were affected.

## 4. Drill: Auth Outage — Graceful Degradation

**Goal:** confirm `PULSE_AUTH_DEGRADED_MODE` behaves as `runbooks/auth-outage.md` claims.

**Pre-work:**
- Point a staging client at a broken Auth endpoint (or toggle the flag directly).
- Have two test accounts: one with a fresh JWT, one with an expired JWT.

**Script:**

1. Set `PULSE_AUTH_DEGRADED_MODE=true` on staging.
2. As each test account, walk through: open app, browse, attempt to post, attempt check-in. Note behavior.
3. Confirm:
   - Fresh-JWT user: reads work, writes work until JWT expiry.
   - Expired-JWT user: sees the degraded-mode banner; write buttons are disabled.
   - Anonymous user: read-only, no refresh storms in the console.
4. Turn the flag off. Confirm both users recover on next app focus.

**Pass criteria:**
- No JS errors thrown during any of the above.
- The banner message is clear and honest.
- No retry storm / 4xx flood in the network tab.

## 5. Drill: Incident Simulation (live, blind)

**Goal:** simulate an end-to-end incident the on-call engineer has not seen.

**Pre-work:**
- The Platform lead (or drill master) picks a scenario from the runbooks **without telling the on-call engineer**.
- Scenarios rotate each year: surge traffic, moderation bypass, data loss, Supabase outage.

**Script:**

1. Drill master injects the signal (e.g., deploys a moderation bypass fixture to staging, or cranks a load generator at staging).
2. On-call engineer responds **as if it were production** — declares incident, opens the runbook, executes.
3. Drill master observes silently; answers yes/no questions only.
4. Drill lasts until on-call declares all-clear or 60 minutes elapses.

**Pass criteria:**
- On-call reaches the correct runbook within 10 min.
- All steps that would have been needed in production were either executed or explicitly called out as "would do in prod".
- Comms templates were used (internal + external).

## 6. Tabletop Drills

Tabletops are conversations, not executions. They take 45–60 min.

**Format:**
1. Drill master reads a one-paragraph scenario.
2. Group walks through the relevant runbook aloud, step by step.
3. At each step, someone plays "the system" and answers "what do you see when you run that?"
4. Surface gaps: unclear instructions, missing queries, commands that require permissions the responder won't have.

**Scenarios rotate from:** Supabase outage, surge traffic, moderation bypass, auth outage, data loss, deploy rollback.

## 7. Post-Drill Review Template

Copy into the Linear `ops-drills` ticket after every drill.

```markdown
## Drill: <name>
**Date:** YYYY-MM-DD
**Participants:** @a @b @c
**Type:** live | tabletop
**Pass/Fail:** pass | partial | fail

## Timeline
- HH:MM — drill started
- HH:MM — first alert fired (target: N min)
- HH:MM — runbook opened
- HH:MM — mitigation executed
- HH:MM — integrity verified
- HH:MM — drill ended

## What went well
- …

## What did not
- …

## Runbook issues found
- [ ] <step X> was ambiguous — update wording
- [ ] <command> failed because of missing permission — grant on-call role
- [ ] Expected alert did not fire — fix threshold in `docs/observability.md`

## Follow-up tickets
- LIN-1234 — …
- LIN-1235 — …

## Next drill
Owner: @X  Target date: YYYY-MM-DD
```

## 8. Escalation During a Drill

If a drill unexpectedly touches production (shouldn't — but if), **stop the drill immediately**, declare a real incident, and switch to prod response. Document the near-miss in the drill log.
