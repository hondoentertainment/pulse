# Pulse Operations: Support Runbook

## Overview

This runbook covers operational procedures for managing the Pulse application. The backend relies on Supabase (PostgreSQL, Auth, Realtime, Storage) deployed via Vercel.

## Quick Reference

| Scenario | Action |
|----------|--------|
| App not loading | Check Vercel deployment status and Supabase connection |
| Database migration failure | Restore from Supabase PITR backup |
| Content takedown needed | Use moderation queue or manual SQL deletion |
| Error spike in production | Check Sentry dashboard for error details |
| Performance degradation | Run Lighthouse CI, check Supabase query performance |

## 1. Architecture and Scaling

### Read-Heavy Discovery

- The app fetches `venues` and `pulses` globally on boot
- If the global payload exceeds 5 MB, enable PostgREST Pagination in `src/lib/supabase-api.ts`
- PostGIS proximity queries (`ST_Distance`) are fully indexed. If sluggish, run `EXPLAIN ANALYZE` on the `venues` table
- Venue scores are recalculated on pulse creation — not on every read

### Write-Heavy Pulse Flows

- Pulses are inserted individually. The app buffers network failures via `src/lib/offline-queue.ts` using `localforage`
- Rate limiting is handled on the client for soft limits. Server-side enforcement via Supabase Edge Functions should be added if abuse scales
- Pulse score recalculation happens synchronously on write — consider moving to a database trigger if write latency becomes an issue

### Caching Strategy

- Service worker precaches the app shell (~4 MB)
- TanStack React Query caches server responses with configurable stale times
- Offline queue persists unsynced writes in `localforage`

## 2. Deployment

### Standard Deploy

Pushes to `main` trigger automatic deployment via the `deploy.yml` GitHub Actions workflow.

### Manual Deploy

```bash
npm run release-check   # lint + test + build + audit
npm run preview          # verify locally
git push origin main     # triggers deploy
```

### Rollback

1. Open the Vercel dashboard
2. Navigate to the project's Deployments page
3. Find the last known-good deployment
4. Click "Promote to Production"

If the issue is database-related, see the Database Rollback section below.

## 3. Database Operations

### Database Rollback

If a critical database migration fails or introduces application downtime:

1. Log into the Supabase Dashboard
2. Navigate to **Database → Backups**
3. Select the Daily Point-in-Time Recovery (PITR) snapshot prior to the migration
4. Click **Restore**

**Important:** PITR restores affect all tables. Coordinate with the team before restoring to avoid overwriting recent legitimate data.

### Manual Queries

For emergency operations, use the Supabase SQL Editor:

```sql
-- Check venue pulse counts
SELECT v.name, COUNT(p.id) as pulse_count
FROM venues v LEFT JOIN pulses p ON p.venue_id = v.id
GROUP BY v.name ORDER BY pulse_count DESC;

-- Find recent pulses for a venue
SELECT * FROM pulses WHERE venue_id = 'xyz'
ORDER BY created_at DESC LIMIT 20;
```

## 4. Moderation and Takedowns

### Standard Moderation

1. The Admin Dashboard queue (`/social-pulse-dashboard`) lists user-reported items via the `ContentReport` interface
2. Review the report and take action (delete, warn, dismiss)

### Emergency Content Takedown

If illegal content requires immediate removal:

1. Locate the `pulse_id` from the report or URL
2. Execute in the Supabase SQL Editor:

```sql
DELETE FROM pulses WHERE id = 'pulse_id_here';
```

3. Clear any cached references by invalidating the venue's pulse cache
4. Document the takedown in the incident log

**Note:** The admin dashboard currently filters local React state only. For a hard deletion, you must use the SQL Editor or a server-side function until server-enforced moderation is implemented.

## 5. Monitoring and Alerting

### Sentry

- Error tracking routes through Sentry
- **Warning** severity: Vercel deployment timeouts, integration provider limits, rate limit hits
- **Fatal** severity: Supabase connection refusal, unauthorized TLS handshake, auth service outage

### Lighthouse CI

- Runs on a schedule via the `lighthouse.yml` workflow
- Tracks performance, accessibility, and best practices scores
- Current accessibility target: 0.85 (goal: 0.95+)

### Health Checks

| What | How to Check |
|------|-------------|
| App availability | Load the production URL |
| Supabase connection | Check Supabase Dashboard → Database → Connection Pooler |
| Deployment status | Vercel Dashboard → project deployments |
| Error rate | Sentry Dashboard → Issues |
| Performance | Lighthouse CI results in GitHub Actions |

## 6. Incident Response

### Triage Steps

1. **Identify** — check Sentry for error details, check Vercel for deployment status
2. **Assess severity** — user-facing outage vs. degraded feature vs. internal tooling
3. **Mitigate** — rollback deployment if needed, disable feature via feature flag if available
4. **Fix** — develop and test fix on a branch, deploy through normal CI
5. **Document** — write incident summary with timeline, root cause, and prevention measures

### Communication

- Engineering team: notify via team channel
- Users: if the outage affects core flows (map, pulse creation, check-in), communicate status
- Stakeholders: brief on impact and estimated resolution

## 7. Common Issues

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| Blank screen on load | Build error or missing chunk | Check Vercel build logs, redeploy |
| Venues not loading | Supabase connection or mock data issue | Check Supabase status, verify seed data |
| Pulse creation fails | Auth issue or rate limit | Check Sentry for specific error |
| Map not rendering | Missing API key or CORS issue | Verify environment variables |
| Offline queue not syncing | Service worker error | Clear SW cache, check offline-queue.ts logs |
| Slow venue discovery | Large payload or missing index | Enable pagination, run EXPLAIN ANALYZE |
