# Runbook: Data Loss

**Severity default:** SEV-1 whenever data loss is suspected. Do not downgrade until scope is bounded.

**Primary owner:** On-call engineer + DB owner (Platform lead).

**Prime directive:** **stop the bleeding before attempting recovery**. A half-restored database is worse than a paused one.

## 1. Detection

- Sentry: `postgres_error` with `violation`, `missing relation`, or unexpectedly empty result sets.
- Support tickets: "my pulses are gone", "my crew disappeared".
- Internal dashboard: row counts on `pulses` / `venues` / `users` drop discontinuously. (Add to `docs/observability.md` if missing.)

**Confirm & scope quickly:**

```sql
-- Row counts snapshot
SELECT 'pulses' AS t, COUNT(*) FROM pulses
UNION ALL SELECT 'venues', COUNT(*) FROM venues
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'content_reports', COUNT(*) FROM content_reports;

-- Compare to the baseline from the nightly snapshot (stored in the
-- `ops_metrics_snapshots` table).
SELECT table_name, row_count, captured_at
FROM ops_metrics_snapshots
ORDER BY captured_at DESC
LIMIT 5;
```

## 2. Immediate Containment (first 5 min)

**Before attempting restore**, stop writes that could compound the loss:

1. Put the app in read-only mode:
   ```bash
   vercel env add PULSE_READ_ONLY_MODE true production
   vercel --prod --force
   ```
   (See `runbooks/supabase-outage.md` for what this disables.)

2. Pause any scheduled jobs that write:
   - Supabase → **Database → Cron** → disable `recompute_venue_score`, `moderation_nightly`, `cleanup_expired_pulses`.

3. Declare SEV-1 in `#incidents` and assign **IC**, **Scribe**, **DB owner**, **Comms**.

## 3. Bound the Loss

1. Identify the earliest affected row(s):
   ```sql
   -- When were rows last known to be present?
   SELECT MAX(created_at) FROM pulses;
   -- Last observed normal count?
   SELECT * FROM ops_metrics_snapshots
   WHERE table_name = 'pulses' AND row_count >= <expected>
   ORDER BY captured_at DESC LIMIT 1;
   ```
2. Identify the **suspected cause**: bad migration, application bug, malicious action, operator error. Look at Supabase → **Logs → Postgres** for DELETE/DROP/TRUNCATE statements in the blast window:
   ```
   -- In the Supabase log explorer
   message ILIKE 'DELETE%' OR message ILIKE 'DROP%' OR message ILIKE 'TRUNCATE%'
   ```
3. Choose a **restore target timestamp** — 1 minute before the destructive event.

## 4. Point-in-Time Recovery (PITR)

PITR retention (see `docs/backup-and-restore.md`): **7 days** on our current plan.

**Decision tree:**

| Scope of loss | Recommended approach |
|--------------|---------------------|
| Single table, < 10k rows | **Branch restore** — restore into a staging project, `COPY` missing rows back. Non-destructive. |
| Single table, large, recent | **Branch restore + bulk copy.** |
| Cross-table, entire DB | **Full PITR restore** — destructive to writes after T. |
| Beyond PITR window | **Daily logical backup** — check the `pulse-backups` S3 bucket (see `docs/backup-and-restore.md`). |

### 4.1 Full PITR (destructive)

Use only when loss is global and recent writes are already lost:

1. Supabase Dashboard → **Database → Backups → Point in Time Recovery**.
2. Select target timestamp.
3. Review the warning — **all writes since T will be lost**.
4. Click **Restore**. Typical duration: 10–30 min for our DB size.
5. Go to section 5.

### 4.2 Branch restore (non-destructive, preferred when possible)

1. Supabase Dashboard → **Branching → New Branch → Restore From PITR**.
2. Pick the target timestamp.
3. Once the branch is ready, connect via its connection string:
   ```bash
   psql "<branch-connection-string>"
   ```
4. Export the missing rows:
   ```sql
   \copy (SELECT * FROM pulses WHERE created_at BETWEEN '<t0>' AND '<t1>') TO '/tmp/pulses_recover.csv' CSV HEADER
   ```
5. Import into production, skipping existing IDs:
   ```sql
   -- On production
   CREATE TEMP TABLE pulses_recover (LIKE pulses INCLUDING ALL);
   \copy pulses_recover FROM '/tmp/pulses_recover.csv' CSV HEADER
   INSERT INTO pulses SELECT * FROM pulses_recover
   ON CONFLICT (id) DO NOTHING;
   ```
6. Drop the branch once integrity is verified.

## 5. Integrity Verification (required before exiting read-only)

Run all of these. Any failure blocks exit from read-only mode.

1. **Row counts back in expected range** (within 1% of pre-incident):
   ```sql
   SELECT table_name, row_count FROM ops_metrics_snapshots
   WHERE captured_at = (SELECT MAX(captured_at) FROM ops_metrics_snapshots);
   ```
2. **Foreign key sanity:**
   ```sql
   SELECT COUNT(*) FROM pulses p LEFT JOIN venues v ON p.venue_id = v.id WHERE v.id IS NULL;
   -- Expect 0.
   SELECT COUNT(*) FROM pulses p LEFT JOIN users u ON p.user_id = u.id WHERE u.id IS NULL;
   -- Expect 0.
   ```
3. **Score consistency:**
   ```sql
   -- Venues with pulses in the last 90 min should have a non-zero live score
   SELECT v.id, v.score, COUNT(p.id) AS recent
   FROM venues v
   LEFT JOIN pulses p ON p.venue_id = v.id AND p.created_at > now() - interval '90 minutes'
   GROUP BY v.id, v.score
   HAVING COUNT(p.id) > 0 AND v.score = 0
   LIMIT 10;
   -- Expect empty.
   ```
4. **Auth integrity:** pick a known test account and sign in end-to-end.
5. **Synthetic `pulse-create-readback` passes** twice consecutively.

## 6. Exit Read-Only

```bash
vercel env rm PULSE_READ_ONLY_MODE production
vercel --prod --force
# Re-enable crons in Supabase dashboard
```

## 7. Communications

We are honest about data loss. Do **not** soft-pedal.

**During:**
```
[14:05 UTC] We've detected a data issue and are investigating. The app is in
read-only mode — you can still browse but can't post. Next update in 30 min.
```

**All-clear, no data lost:**
```
[15:45 UTC] Issue resolved. No user data was lost. Posting is back on.
```

**All-clear, data was lost:**
```
[15:45 UTC] We restored the database from a backup. Pulses and check-ins
posted between 13:40 and 14:05 UTC were lost. We're sorry — a full write-up
will follow within 5 business days.
```

## 8. Post-incident

- Post-mortem within 5 business days. Specifically document:
  - Root cause of the deletion.
  - Why existing safeguards failed.
  - What control prevents this class of loss going forward (e.g. remove DROP / TRUNCATE from the service role, require 2-person approval for prod migrations).
- Verify the next scheduled **restore drill** (`docs/chaos-drills.md`) exercises this runbook.
