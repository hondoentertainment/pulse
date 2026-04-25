# Runbook: Bad Deploy

**Severity default:** SEV-1 if production is broken for all users. SEV-2 if a specific feature is broken but the app loads.

**Primary owner:** Deploying engineer; on-call if the deployer is unavailable.

## 1. Detection

- Sentry: new error pattern appears within 10 min of a deploy.
- Vercel: deployment marked `Ready` but synthetic `pulse-create-readback` fails.
- User reports in `#support`.
- Core Web Vitals regression (`LCP p75 > 4s` in Vercel Speed Insights) starting at deploy timestamp.

**Confirm the bad deploy:**

```bash
# List recent deployments and timestamps
vercel ls pulse-prod --meta --count 10

# Open the offending commit in GitHub
gh pr view $(gh pr list --state merged --limit 1 --json number -q '.[0].number') --web
```

## 2. Rollback Decision

Rollback is the **first option**. Root-cause after, not before.

**Rollback if any of:**

- Error rate > 2× baseline.
- A core user path (open app, post pulse, view map, sign in) is broken.
- A data-corruption risk is suspected (see section 4 before rolling back).

**Do not rollback if:**

- The bug is cosmetic and a forward fix is < 30 min.
- The deploy included a DB migration that is not safely reversible (see section 4 — partial rollback may be required).

## 3. Rollback Via Vercel (app code)

**Fastest path (< 2 min):**

1. Vercel Dashboard → **Deployments** → find the last deployment with a green checkmark before the bad one.
2. Click `•••` → **Promote to Production**.
3. Watch the production URL reload with the previous build hash. Confirm:
   ```bash
   curl -sS https://pulseapp.example/_meta | jq .gitCommit
   ```
4. Post in `#incidents`:
   ```
   Rolled back to <commit-sha>. Investigating root cause of <bad-sha>.
   ```

**CLI alternative:**

```bash
vercel rollback <previous-deployment-url> --scope=<team> --yes
```

**Revert the merge commit in git** as a follow-up so the next `main` deploy doesn't re-ship the bad code:

```bash
git revert -m 1 <bad-merge-sha>
git push origin main
```

## 4. Rolling Back a DB Migration

DB rollback is **not** symmetric with code rollback. Always evaluate first.

### 4.1 Classify the migration

| Type | Example | Rollback strategy |
|------|---------|-------------------|
| **Additive** (new table, new nullable column, new index) | `ALTER TABLE pulses ADD COLUMN mood text NULL;` | **Do nothing** — old code ignores the new column. Roll back app code only. |
| **Renamed / changed type** | `ALTER TABLE pulses RENAME COLUMN caption TO message;` | **Avoid at all costs**; requires dual-write. See 4.3. |
| **Destructive** (drop column, drop table) | `ALTER TABLE pulses DROP COLUMN caption;` | **Restore via PITR** if data loss is unacceptable. See `runbooks/data-loss.md`. |
| **Data backfill** (UPDATE statements) | `UPDATE pulses SET score = ...;` | Usually not reversible. If the backfill itself is wrong, restore via PITR; otherwise forward-fix. |

### 4.2 PITR restore for a destructive migration

Only if rollback is required **and** PITR retention covers the pre-migration timestamp:

1. Supabase Dashboard → **Database → Backups → Point in Time Recovery**.
2. Pick a timestamp 1–2 minutes **before** the migration ran.
3. **Coordinate in `#incidents`** — all writes since that timestamp will be lost.
4. Click **Restore**. Wait for confirmation.
5. Verify schema:
   ```sql
   \d pulses
   ```
6. Redeploy the app from the commit before the migration merged.

### 4.3 Dual-write pattern (preferred migration strategy going forward)

To make future migrations safely reversible, follow the **expand → migrate → contract** pattern:

1. **Expand:** ship a migration that adds the new shape **additively** (e.g. a new column `message`, keeping `caption`). App code writes to **both**.
2. **Migrate:** backfill existing rows. Verify both columns match.
3. **Shift reads:** flip app reads to the new column, still writing both.
4. **Contract:** after ≥ 7 days of stable dual writes, ship a second migration dropping the old column.

Each step is independently deployable and rollback-safe. If something goes wrong in step 3, roll back to step 2's code — the old column still has correct data.

Document every non-additive migration in `docs/backend-migration.md` (if present) with its expand/contract steps.

## 5. Communications Template

**Internal (always):**
```
[incident] Rolling back deploy <sha>. Reason: <one line>. ETA to restore: <2 min / 15 min>.
IC: @me  Comms: @X  Scribe: @Y
```

**External (if user-visible):**
```
[14:22 UTC] We just released an update that broke <feature>. We've rolled back
and the app is back to normal. Sorry for the interruption.
```

## 6. Post-incident

- Open a Linear ticket for the root cause fix.
- Add a test that would have caught the regression (required before re-landing).
- If a migration caused the incident, add a pre-flight check to CI (schema diff review gate).
- Schedule a deploy-rollback tabletop at the next quarterly drill (`docs/chaos-drills.md`).
