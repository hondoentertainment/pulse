# Backup and Restore

This document describes Pulse's backup strategy, how to run a restore, and the drill cadence that keeps the process honest.

## 1. What We Back Up

| Asset | Mechanism | Retention | Owner |
|-------|----------|-----------|-------|
| Supabase Postgres (all tables) | Supabase **Point-in-Time Recovery (PITR)** — continuous WAL | **7 days** (current plan) | Platform lead |
| Supabase Postgres (logical) | Nightly `pg_dump` → S3 bucket `pulse-backups` | **90 days** | Platform lead |
| Supabase Storage (media uploads) | Bucket versioning + lifecycle to Glacier | **90 days** active, 1 year Glacier | Platform lead |
| Supabase Auth users | Included in `pg_dump` (`auth.users` table) | Same as logical | Platform lead |
| App repo | GitHub + mirror to backup org | Forever | Platform lead |
| Vercel env / secrets | 1Password vault `pulse-prod` | Forever | Platform lead |
| Supabase migrations | Git (`supabase/migrations/`) | Forever | Platform lead |

## 2. PITR — How It Works

PITR replays WAL against the last base backup. You choose any timestamp within the retention window; Supabase rebuilds the cluster to that exact second.

- **Recovery Point Objective (RPO):** ≤ 1 minute (WAL shipping interval).
- **Recovery Time Objective (RTO):** ≤ 30 minutes for DBs of our current size.

PITR covers the **entire database**, not individual tables. For partial restores, use a **branch restore** (below).

## 3. Nightly Logical Backup

Runs via GitHub Actions workflow `backup.yml` every day at **04:00 UTC**.

- `pg_dump --format=custom --jobs=4` against the read replica.
- Upload to `s3://pulse-backups/nightly/YYYY-MM-DD.dump` (encrypted with SSE-KMS).
- Keep latest 90 nightlies; keep the first-of-month for 1 year.
- The workflow fails the build if the dump is smaller than 80% of the previous night's — guard against silent data loss.

Verify a recent nightly exists:

```bash
aws s3 ls s3://pulse-backups/nightly/ | tail -5
```

## 4. Restore Playbook

### 4.1 PITR restore (destructive to prod)

Use for whole-DB disasters — see `runbooks/data-loss.md` section 4.1.

### 4.2 Branch restore (non-destructive)

Use for partial / single-table recovery. Full steps in `runbooks/data-loss.md` section 4.2. Summary:

1. Supabase Dashboard → **Branching → New Branch → Restore From PITR → pick T**.
2. Export the rows you need from the branch.
3. Insert into prod with `ON CONFLICT DO NOTHING`.
4. Drop the branch.

### 4.3 Logical-backup restore (DR, > 7 days ago)

Only for catastrophic loss beyond the PITR window.

1. Provision a fresh Supabase project (or use the staging project if not in use).
2. Download the dump:
   ```bash
   aws s3 cp s3://pulse-backups/nightly/2026-04-10.dump /tmp/pulse.dump
   ```
3. Restore into the new project:
   ```bash
   pg_restore --no-owner --no-privileges --dbname="<new-db-url>" --jobs=4 /tmp/pulse.dump
   ```
4. Repoint Vercel env `SUPABASE_URL` / `SUPABASE_ANON_KEY` to the new project.
5. Redeploy. Accept the DNS / cert settling time (~15 min).
6. Communicate the cutover and the expected data loss window.

## 5. Monthly Backup Drill Checklist

**Cadence:** first Tuesday of every month. **Owner:** rotating engineer (see `docs/on-call.md`).

Do all of this against the **staging** project (not prod):

- [ ] Confirm last night's `pulse-backups/nightly/` dump exists and is within 20% of the previous night's size.
- [ ] Download the dump.
- [ ] Restore into a scratch project (or local `docker run supabase/postgres` for speed):
  ```bash
  pg_restore --no-owner --no-privileges --dbname="<scratch-url>" --jobs=4 /tmp/pulse.dump
  ```
- [ ] Assert table row counts match the nightly snapshot in `ops_metrics_snapshots`.
- [ ] Run the integrity queries from `runbooks/data-loss.md` section 5.
- [ ] Spot-check one known pulse (by ID) is present with correct fields.
- [ ] Record elapsed restore time in the drill log (Linear project `ops-drills`).
- [ ] **Fail the drill** if any step errors — file a SEV-3 incident and fix before next month.

## 6. Quarterly Restore Testing (full drill)

**Cadence:** last week of Q1, Q2, Q3, Q4. **Owner:** Platform lead.

This is the real thing, end-to-end — see `docs/chaos-drills.md` for the full script. Goals:

1. Run a **PITR restore** against a branch and verify the app points to it cleanly.
2. Run a **logical-backup restore** into a fresh project, verify schema + row counts + a smoke test.
3. Measure RTO and RPO against targets (RPO ≤ 1 min, RTO ≤ 30 min).
4. File tickets for anything that didn't meet target.

## 7. Data Integrity Verification (post-restore)

Whichever restore path you used, run these before declaring recovery complete. Full SQL in `runbooks/data-loss.md` section 5.

1. Row counts within 1% of pre-incident snapshot.
2. Foreign keys intact (`pulses.venue_id`, `pulses.user_id`, `content_reports.target_id`).
3. Venue score consistency.
4. Sign-in works for a known probe account.
5. Synthetic `pulse-create-readback` passes twice.

## 8. Escalation

If PITR and the latest nightly are both unrecoverable:

1. Declare SEV-1, page the Platform lead.
2. Engage Supabase support (Pro+ plan) — they can sometimes restore from internal base backups beyond customer-visible retention.
3. If ultimate data loss is confirmed, communicate publicly per `runbooks/data-loss.md` section 7.

## 9. Open Items

- [ ] Automate the monthly drill to run in CI against staging (currently manual).
- [ ] Extend PITR retention to 14 days on the next plan review.
- [ ] Add `ops_metrics_snapshots` nightly job if not yet in place.
