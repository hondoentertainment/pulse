# On-Call

Pulse runs a small rotation. This page covers how the rotation works, what tools you need access to, and how to hand off cleanly. For *how to respond* to a page, see `docs/incident-response.md` and the runbooks in `docs/runbooks/`.

## 1. Rotation

- **Shift length:** 1 week, Tuesday 10:00 local → following Tuesday 10:00.
- **Who:** every engineer on the core team rotates. Platform lead holds the escalation pager permanently.
- **Schedule:** maintained in PagerDuty service `pulse-prod`. Exported read-only view: `oncall.pulseapp.example/schedule`.
- **Swaps:** swap freely with any peer — update PagerDuty and drop a note in `#oncall`. No approval needed.

## 2. Responsibilities

During your week, you are on the hook for:

1. **Respond to pages** — ack within 5 minutes during business hours, 15 minutes off-hours. Follow the relevant runbook.
2. **Run the daily health check** (5 min, first thing) — see section 6.
3. **Clear the alert queue** — keep Sentry `unresolved` to a minimum; file Linear tickets for anything non-urgent.
4. **Monthly backup drill** (if your week contains the first Tuesday of the month) — see `docs/backup-and-restore.md` section 5.
5. **Hand off** cleanly at end of shift — see section 7.

You are **not** on the hook for:

- Feature work on your on-call week (reduced by design — expect a 50% week).
- Deep customer support (that's Support's rotation — you only escalate if they find something systemic).

## 3. Escalation

| Situation | Escalate to | How |
|-----------|------------|-----|
| Can't ack a page | Secondary on-call | PagerDuty auto-routes after 10 min |
| SEV-1 confirmed | Platform lead + Engineering manager | PagerDuty "escalate" button + ping in `#incidents` |
| Need Supabase support | Platform lead | Supabase support portal + Slack `#incidents` |
| Legal / T&S content | Trust & Safety DRI | PagerDuty service `pulse-trust-safety` |
| Comms to users | Comms on-call | PagerDuty service `pulse-comms` |

The full severity matrix and escalation chain live in `docs/incident-response.md` — read it before your first shift.

## 4. Tooling Access (get these set up before your first shift)

- [ ] PagerDuty login + mobile app installed, push notifications on.
- [ ] Vercel: member of the `pulse` team, role ≥ Developer.
- [ ] Supabase: member of the `pulse-prod` org, role ≥ Developer (Owner for data-loss scenarios — keep one Owner on-call at all times).
- [ ] Sentry: member of the `pulse` org, access to `pulse-web` and `pulse-api` projects.
- [ ] Slack channels joined: `#incidents`, `#oncall`, `#eng-alerts`, `#trust-safety`, `#support`.
- [ ] 1Password vault `pulse-prod` — for prod secrets when a runbook calls for them.
- [ ] `gh` CLI authenticated.
- [ ] `vercel` CLI authenticated (`vercel login`).
- [ ] `supabase` CLI authenticated (`supabase login`).
- [ ] Status page admin (Statuspage) — bookmarked.

Test access on day one:

```bash
vercel whoami            # expect your email
supabase projects list   # expect pulse-prod visible
gh auth status           # expect authenticated
```

## 5. Handy Commands

```bash
# Recent production deploys
vercel ls pulse-prod --count 10

# Production logs (last 10 min)
vercel logs pulse-prod --since 10m

# Run the load test against staging
LOAD_TARGET_URL=https://staging.pulseapp.example bun run load-test

# Open the prod DB (read-only role)
supabase db remote commit --project-ref <ref>   # for migrations
psql "$SUPABASE_PROD_READONLY_URL"              # for ad-hoc reads
```

## 6. Daily Health Check

Five minutes, once a day, usually first thing:

1. Sentry: scan unresolved issues from the last 24 h. Anything new and high-volume?
2. Vercel: glance at Analytics → Errors (5xx rate). Anything above baseline?
3. Supabase: dashboard → Database → Connection Pooler. Errors? Pool near cap?
4. Status page: any open incidents you forgot to close?
5. PagerDuty: any un-acked alerts?

Log the check in `#oncall` with a one-line status (`✅ quiet`, `⚠️ investigating X`).

## 7. Handoff Template

Post this in `#oncall` at end of shift (Tuesday 10:00):

```markdown
## Handoff — week of YYYY-MM-DD → next: @<incoming>

**Pages taken this week:** <N>
- <short summary of each, linked to the incident doc>

**Open issues (non-paging):**
- [ ] <Sentry issue / Linear ticket> — status
- [ ] …

**Things to watch:**
- <e.g. "Moderation false-positive rate is creeping up after Tuesday's rule change">

**Ongoing experiments / flags:**
- `PULSE_MODERATION_STRICT_NORMALIZE=true` (set 2026-04-15, keeping for another week)

**Drills due:**
- [ ] Monthly backup drill — run by 2026-04-28

Handoff complete. Pager is yours. Have a quiet week. 🫡
```

## 8. What "Good" Looks Like

- You do not ship risky changes on Friday afternoon during your on-call week.
- You leave the alert queue smaller than you found it.
- You update the runbook you used when you find a step that was wrong or missing — the next on-call inherits a better doc.
