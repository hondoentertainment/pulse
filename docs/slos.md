# Service Level Objectives (SLOs)

## Purpose

This document defines the Service Level Objectives (SLOs) for Pulse and ties each target to a monitoring source and an alert rule. SLOs are the contract between product reliability and engineering velocity: if we are inside budget, ship; if we are burning budget, freeze risky work and fix.

SLO review cadence: **monthly**, first business day of the month. Owner: Platform lead.

## 1. Availability

**Target:** 99.9% of successful HTTP responses (non-5xx) over a rolling 30-day window.

**Error budget:** `0.1% of 30d = 43m 49s` of allowed downtime / error per month.

**Measurement window:** 30 days, rolling.

**Measurement source:** Vercel Analytics → "Edge Requests" split by status, filtered `status < 500`. Supplement with Sentry `transaction.status` for API routes.

**Burn-rate alerts (PagerDuty → `#ops-alerts`):**

| Alert | Window | Burn rate | Means |
|-------|--------|-----------|-------|
| Fast burn | 1h | > 14.4× | 2% budget in 1h → page immediately |
| Medium burn | 6h | > 6× | 5% budget in 6h → page |
| Slow burn | 24h | > 1× | Drifting toward miss → ticket |

**If budget exhausted:** stop shipping non-critical changes, open a reliability workstream, and review the SLO at end of window.

## 2. API Latency

**Measurement source:** Vercel `duration` metric on function invocations + Sentry performance spans. Export daily via the Vercel Logs API to a BigQuery sink (setup: `docs/observability.md`).

**Targets (p95 server time, excluding cold-start first-request-per-region):**

| Endpoint | p50 | p95 | p99 | Rationale |
|---------|-----|-----|-----|-----------|
| `POST /api/pulses/create` | 120 ms | 300 ms | 600 ms | Pulse write path — must feel instant in the UI. p95 budget allows one Supabase insert + score recompute round-trip. |
| `POST /api/moderation/check` | 150 ms | 400 ms | 800 ms | Synchronous on the create path; budget sized so `create + moderation` stays under ~700 ms p95 combined. |
| `GET /api/pulses` (list, last 200) | 80 ms | 200 ms | 400 ms | Served largely from React Query cache; server target only applies to cold paths. |
| Supabase `venues` proximity query (`ST_Distance`) | 50 ms | 150 ms | 300 ms | PostGIS indexed; regressions indicate missing index or seq scan. |
| Supabase `pulses` insert (DB only) | 20 ms | 80 ms | 200 ms | Single-row write, no triggers on hot path. |
| Supabase `pulses` read (last 200 for venue) | 30 ms | 120 ms | 250 ms | Index on `(venue_id, created_at)` required. |

**Alert thresholds:**

- Warn (Slack `#eng-alerts`): p95 > target for **5 consecutive minutes**.
- Page (PagerDuty): p95 > 2× target for **10 consecutive minutes**, OR p99 > target for **15 minutes**.
- Ticket (auto-open Linear): p95 drift > 20% week-over-week at the monthly review.

## 3. Client Performance (Core Web Vitals)

**Measurement source:** Vercel Speed Insights (RUM) — **p75 at the 28-day window, per visit**, matching the Chrome UX Report "good" definition.

| Metric | Target (p75) | Threshold source |
|--------|-------------|------------------|
| LCP (Largest Contentful Paint) | **< 2.5 s** | CWV "good" |
| INP (Interaction to Next Paint) | **< 200 ms** | CWV "good" |
| CLS (Cumulative Layout Shift) | **< 0.1** | CWV "good" |
| FCP (First Contentful Paint) | < 1.8 s | CWV "good" (monitored, not SLO) |
| TTFB (Time to First Byte) | < 800 ms | CWV "good" (monitored, not SLO) |

**Alert thresholds:**

- Warn: any CWV p75 exceeds target for 3 consecutive days.
- Page: LCP p75 > 4 s OR INP p75 > 500 ms for 1 hour (indicates regression shipped).
- Blocked deploy: Lighthouse CI fails performance budget (see `lighthouserc.json` / `docs/bundle-budget.md`).

## 4. Pulse Creation Success Rate

**Target:** **> 99%** of `/api/pulses/create` attempts succeed (HTTP 2xx + eventual persistence).

**Definition of success:** request returns 2xx **and** the pulse is visible on a subsequent read within 10s (verified via synthetic monitor).

**Measurement source:**

- Server: Vercel function status split for `/api/pulses/create`.
- Client: Sentry breadcrumb `pulse_create_attempt` → `pulse_create_success|pulse_create_failed` ratio.
- End-to-end: Checkly synthetic every 5 min (create + read-back).

**Alert thresholds:**

- Warn: success rate < 99% over 15 min (rolling).
- Page: success rate < 95% over 5 min, OR 3 consecutive synthetic failures.
- The offline queue (`src/lib/offline-queue.ts`) does **not** count toward failure — queued writes that later succeed count as success; queued writes that ultimately drop count as failure.

## 5. Real-Time Message Delivery Latency

**Target:** **p95 end-to-end latency < 2 s**, p99 < 5 s, from `pulses.insert` commit to subscribed clients receiving the change.

**Measurement source:**

- Supabase Realtime dashboard → "Broadcast latency".
- Client-side instrumentation: timestamp on insert vs. `postgres_changes` callback receipt, logged via analytics `realtime_delivery_latency_ms`.

**Alert thresholds:**

- Warn: p95 > 2 s for 10 min.
- Page: p95 > 10 s for 5 min, OR realtime channel drop rate > 5% over 5 min.

## 6. Auth Success Rate

**Target:** **> 99.5%** of Supabase Auth sign-in / token refresh calls succeed over 30 days.

**Measurement source:** Supabase dashboard → Auth → "Sign-in success rate"; client Sentry event `auth.refresh.failed`.

**Alert thresholds:**

- Warn: < 99.5% for 15 min.
- Page: < 95% for 5 min (indicates Auth-service outage — see `runbooks/auth-outage.md`).

## 7. Content Moderation Efficacy (quality SLO)

**Target:** **< 0.5%** of user-visible pulses require post-publish takedown within 30 days of creation.

**Measurement source:** count of rows in `pulses` with `moderation_status = 'removed'` and `created_at > now() - 30 days`, divided by total `pulses` created in the same window. Run as a nightly scheduled query.

**Alert thresholds:**

- Warn: ratio > 0.5% in weekly report → open Linear ticket, review moderation rule set.
- Page: ratio > 2% in 24h → see `runbooks/content-moderation-bypass.md`.

## SLO → Alert Mapping Summary

| SLO | Monitoring source | Warn channel | Page channel |
|-----|------------------|--------------|--------------|
| Availability | Vercel Analytics + Sentry | Slack `#eng-alerts` | PagerDuty |
| API latency (per endpoint) | Vercel duration + Sentry spans | Slack `#eng-alerts` | PagerDuty |
| Core Web Vitals (LCP/INP/CLS) | Vercel Speed Insights | Slack `#eng-alerts` | PagerDuty |
| Pulse creation success | Vercel status + Sentry + Checkly | Slack `#eng-alerts` | PagerDuty |
| Realtime latency | Supabase Realtime + client RUM | Slack `#eng-alerts` | PagerDuty |
| Auth success | Supabase Auth metrics | Slack `#eng-alerts` | PagerDuty |
| Moderation efficacy | Supabase scheduled query | Slack `#trust-safety` | PagerDuty |

## Load-Test Gates

The load test in `scripts/load-test.ts` uses the API latency p95 SLOs above as its pass/fail thresholds. Run it before every release that touches `api/` or core write paths:

```bash
LOAD_TARGET_URL=https://staging.pulseapp.example bun run load-test
```

## Changelog

- **2026-04-17** — Initial SLOs published alongside runbooks and chaos drills.
