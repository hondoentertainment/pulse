# Runbook: Surge Traffic

**Severity default:** SEV-2 if latency degrades but no errors. SEV-1 if error rate > 1% or site is unreachable.

**Primary owner:** On-call engineer.

## 1. Detection

You will be paged by one of:

- Vercel: function concurrency > 80% of plan cap.
- Vercel: `/api/pulses/*` p95 > 600 ms for 5 min.
- Sentry: `429` responses or `fetch failed` client errors spiking.
- Supabase: connection pool saturation ("remaining connections" < 10%).

## 2. Triage (first 3 min)

1. Confirm surge vs. attack:
   ```bash
   # Check Vercel logs for requests grouped by IP
   vercel logs pulse-prod --since 10m --output raw \
     | jq -r '.proxy.clientIp' | sort | uniq -c | sort -rn | head -20
   ```
   A few IPs >> traffic → see `runbooks/bad-deploy.md` (wrong doc) / DDoS playbook below. Many distinct IPs with natural growth → organic surge.
2. Open Vercel → **Analytics → Live** and Supabase → **Reports → API**. Note the peak RPS and 95th percentile duration.
3. Post in `#incidents`:
   ```
   /incident declare sev2 "Traffic surge — p95 latency degraded"
   ```

## 3. Mitigation

### Step 1 — Raise Vercel function limits

1. Vercel Dashboard → **Project → Settings → Functions**.
2. Set `Max Duration` to the plan ceiling (Pro: 300 s, Enterprise: 900 s). We default to 10 s; do **not** push past 30 s — long functions mask problems.
3. Upgrade function memory to `1024 MB` for `/api/pulses/create` if CPU-bound.

### Step 2 — Tune rate limits (defensive)

Client-side soft limits are in `src/lib/rate-limit.ts`. Server-side enforcement lives in `api/` handlers (when implemented) via a Supabase Edge Function key.

For an immediate tighten during a surge, lower the per-IP pulse-create ceiling:

```bash
vercel env add PULSE_RATE_LIMIT_CREATE_PER_MINUTE 10 production  # default 30
vercel --prod --force
```

Bump back up once p95 recovers.

### Step 3 — Push more to the CDN

1. For any read-mostly route (`/api/venues-cache`, `/api/pulses` list), confirm Vercel cache headers are set:
   ```
   Cache-Control: s-maxage=30, stale-while-revalidate=60
   ```
2. Temporarily extend `s-maxage` to `120` in `vercel.json` if the surge is localized in time. Redeploy.

### Step 4 — Supabase protection

1. Supabase Dashboard → **Database → Connection Pooler** → ensure **Transaction mode** is enabled (it is — verify).
2. Raise pool size incrementally (do **not** exceed DB `max_connections / 2`). Default 15; surge ceiling 25.
3. Kill runaway queries:
   ```sql
   SELECT pid, now() - query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND now() - query_start > interval '5 seconds'
   ORDER BY duration DESC;
   -- SELECT pg_terminate_backend(<pid>);
   ```

### Step 5 — Graceful degradation

If pressure persists after Steps 1–4:

1. Flip `PULSE_DEGRADED_MODE=true` (feature flag). This disables:
   - Real-time subscription on the `pulses` table (clients poll every 60 s instead).
   - Synchronous moderation check on create (queued for async processing — flag `moderation.async = true`).
   - The `recommendations` panel on the home screen.
2. Return a 503 with `Retry-After: 30` from non-critical endpoints (e.g. `/api/events`) rather than letting them queue.

### Step 6 — If it's an attack

- Enable Vercel **Attack Challenge Mode**: Dashboard → **Firewall → Attack Challenge Mode: ON**.
- Add a temporary IP block for the top offender(s) in the WAF rules.
- Escalate to Vercel support if sustained > 30 min.

## 4. Recovery

1. Watch p95 for two consecutive 5-min windows back under target.
2. Reverse the env var changes (`PULSE_RATE_LIMIT_CREATE_PER_MINUTE`, `PULSE_DEGRADED_MODE`) and redeploy.
3. Keep raised pool size for 24 h, then return to default.

## 5. Communications Template

**During:**
```
[14:10 UTC] We're seeing an unusually large crowd right now and some of you
may see slower load times or a short delay when posting a pulse. We're
scaling up and expect things to feel normal within 15 minutes.
```

**All-clear:**
```
[14:45 UTC] The app is back to full speed. Thanks for being patient — the
crowd that showed up tonight was our biggest ever.
```

## 6. Post-incident

- File follow-ups if Step 5 (degraded mode) was needed — we should not be this fragile.
- Re-run the load test (`bun run load-test`) at the new peak RPS + 50% to confirm headroom.
- Consider adding the new peak as the default target in `scripts/load-test.ts`.
