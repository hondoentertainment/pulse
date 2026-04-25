# Runbook: Supabase Outage

**Severity default:** SEV-1 if the database is unreachable in production. Downgrade to SEV-2 once read-only mode is live and users can still browse.

**Primary owner:** On-call engineer. **Pager:** PagerDuty service `pulse-prod`.

## 1. Detection

You will typically be paged by one of:

- Sentry: spike in `PostgrestError` / `AuthApiError` / `FetchError: Failed to fetch`.
- Vercel: `/api/pulses/*` 5xx rate > 5% for 5 min.
- Supabase status page: `status.supabase.com` red or yellow.
- Synthetic (Checkly): `pulse-create-readback` failing consecutively.

**Confirm outage in < 2 min:**

1. Open https://status.supabase.com — note the affected region.
2. Run:
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' "https://<PROJECT_REF>.supabase.co/rest/v1/venues?select=id&limit=1" \
     -H "apikey: $SUPABASE_ANON_KEY"
   ```
   Expect `200`. Any 5xx / timeout confirms.
3. In Supabase Dashboard → **Database → Connection Pooler**: check "Active connections" and "Errors".

## 2. Triage (first 5 min)

1. **Declare the incident** in Slack `#incidents`:
   ```
   /incident declare sev1 "Supabase outage — read/write failing"
   ```
2. **Post status** on status page via `status.pulseapp.example` (Statuspage admin):
   > "We are investigating elevated errors. Pulse creation and login may fail. Updates in 15 min."
3. **Assign roles:** IC (you), Comms (next on-call), Scribe (link to the incident doc).

## 3. Mitigation

### Path A — Regional issue, single Supabase region

If the status page shows a single-region outage and you have a read replica in another region:

1. Supabase Dashboard → **Settings → Infrastructure → Read Replicas**.
2. Promote the healthy replica to primary **only if** Supabase support confirms the primary is unrecoverable (coordinate on the Supabase support ticket first — promotion is destructive to in-flight writes).

### Path B — Full Supabase outage, enable read-only mode

If no replica is available, flip the app into **read-only degraded mode**:

1. Set the feature flag in Vercel:
   ```bash
   vercel env add PULSE_READ_ONLY_MODE true production
   vercel env add PULSE_READ_ONLY_MODE true preview
   vercel --prod --force   # redeploys with new env
   ```
   The client reads this via `import.meta.env.VITE_PULSE_READ_ONLY_MODE` and will:
   - Disable pulse create / check-in buttons with a banner.
   - Keep map + discover reading from TanStack Query cache (stale-while-revalidate).
   - Route writes into the offline queue (`src/lib/offline-queue.ts`), which will drain on recovery.

2. Push a CDN-cached fallback for the venue list: Vercel Edge Config already mirrors `/api/venues-cache` — confirm it is being served:
   ```bash
   curl -sS -I "https://pulseapp.example/api/venues-cache" | grep -i 'x-vercel-cache'
   # expect: x-vercel-cache: HIT
   ```

3. If Auth is also down, see `runbooks/auth-outage.md` — short-circuit to anonymous read-only.

## 4. Recovery

1. Wait for Supabase status page green + 5 min of clean synthetic runs.
2. Disable read-only mode:
   ```bash
   vercel env rm PULSE_READ_ONLY_MODE production
   vercel --prod --force
   ```
3. Monitor offline queue drain. Open Sentry search: `event.message:"offline-queue:drain"`. Expect a burst followed by quiet.
4. Verify SLOs back in budget (see `docs/slos.md`) — pulse create success > 99%, pulse creation p95 back under 300 ms.

## 5. Communications Template

**During (every 30 min):**
```
[UPDATE 14:30 UTC] Supabase is still experiencing an outage affecting pulse
creation and sign-in. The app remains available in read-only mode — you can
still browse nearby venues. Next update at 15:00 UTC.
```

**All-clear:**
```
[RESOLVED 15:45 UTC] Pulse creation, check-ins, and sign-in are fully
restored. Any pulses you submitted during the outage have been synced. Thanks
for your patience. A post-mortem will be published within 5 business days.
```

## 6. Post-incident

1. Open a post-mortem using the template in `docs/incident-response.md` (if present) or the standard 5-whys format.
2. File follow-ups:
   - Add any new failure signal to `docs/observability.md`.
   - If read-only mode had bugs, open a Linear ticket tagged `reliability`.
3. Schedule a tabletop of this runbook at the next quarterly drill (`docs/chaos-drills.md`).
