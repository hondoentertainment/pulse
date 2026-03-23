# Pulse Operations: Support Runbook

## Overview
This runbook covers the operational procedures for managing the Pulse backend, which relies entirely on Supabase (PostgreSQL, Auth, Realtime, Storage).

## 1. Architecture Scaling Assumptions

**Read-Heavy Discovery**
- The app fetches `venues` and `pulses` globally on boot.
- If the global payload exceeds 5MB, we must enable **PostgREST Pagination** in `src/lib/supabase-api.ts`.
- PostGIS proximity queries (`ST_Distance`) are fully indexed. If sluggish, run `EXPLAIN ANALYZE` on the `venues` table.

**Write-Heavy Pulse Flows**
- Pulses are inserted individually. The application buffers network failures via `src/lib/offline-queue.ts` which uses `localforage`.
- Rate limiting is handled on the client (for soft limits to prevent abuse) and should be hardened using standard Supabase Edge Functions in the future if abuse scales.

## 2. Rollback Procedures

If a critical database migration fails or introduces application downtime:
1. Log into the Supabase Dashboard.
2. Navigate to **Database -> Backups**.
3. Select the Daily Point-in-Time Recovery (PITR) snapshot prior to the migration.
4. Click **Restore**.

## 3. Moderation & Takedowns

1. The Admin Dashboard queue (`/social-pulse-dashboard`) lists user-reported items in the `ContentReport` interface.
2. By clicking "Delete Pulse", the frontend issues a command to erase the content locally.
3. **Important**: Because we migrated to Supabase, to perform a *hard deletion*, the admin dashboard must execute an authenticated `DELETE FROM pulses WHERE id=?` via the Supabase client. Wait, currently the dashboard only filters the local React state.
4. If illegal content requires an emergency takedown, locate the `pulse_id` and manually execute `DELETE FROM pulses WHERE id = 'xyz'` in the Supabase SQL Editor.

## 4. On-Call Expectations
- Alerting routes through **Sentry**.
- "Warning" severity alerts generally indicate Vercel deployment timeouts or integration provider limits.
- "Fatal" severity alerts page the on-call engineer and generally indicate a Supabase connection refusal or unauthorized TLS handshake.
