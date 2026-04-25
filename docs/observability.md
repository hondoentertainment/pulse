# Pulse Observability Guide

This document covers structured logging, product analytics, performance
telemetry, alerting, and on-call basics. The companion doc
[`incident-response.md`](./incident-response.md) covers what to do when
something actually breaks.

---

## 1. Stack Overview

| Concern                 | Tool                                             | Source of truth                             |
| ----------------------- | ------------------------------------------------ | ------------------------------------------- |
| Error tracking          | Sentry (`@sentry/react`)                         | `src/main.tsx`                              |
| Session replay          | Sentry Replay                                    | `src/main.tsx`                              |
| Web vitals / perf       | Vercel Speed Insights + custom observer          | `src/lib/observability/web-vitals.ts`       |
| Product analytics       | Pluggable adapter (Amplitude / PostHog stubs)    | `src/lib/observability/analytics.ts`        |
| Structured logs         | Logger with Sentry breadcrumb + HTTP sinks       | `src/lib/observability/logger.ts`           |
| Uptime / SLA            | Vercel + external uptime probe (recommended)     | See section 5                               |

All observability modules live in `src/lib/observability/`. The React
hook `useTrack` in `src/hooks/use-track.ts` is the recommended entry
point inside components.

---

## 2. Adding a New Analytics Event

1. Open `src/lib/observability/analytics.ts`.
2. Add a new key + shape to the `EventRegistry` interface. Keep prop
   cardinality low — avoid free-form strings where an enum works.
3. Append the new name to `REGISTERED_EVENTS`.
4. In your component, import the hook and call it:

   ```ts
   import { useTrack } from '@/hooks/use-track'

   function PulseComposer() {
     const track = useTrack({ component: 'PulseComposer' })
     // ...
     track('pulse_created', {
       pulseId,
       venueId,
       hasPhoto: true,
       hashtagCount: 2,
     })
   }
   ```

5. (Optional) Update any dashboard queries to reference the new event.
6. TypeScript guarantees the props match the registry — a typo or
   missing field is a compile error.

### Naming conventions

- **Event names:** `snake_case`, past-tense verb. `pulse_created` not
  `createPulse`. Group by noun first so related events sort together
  (`pulse_*`, `venue_*`).
- **Props:** `camelCase`, scalar where possible. Attach IDs rather than
  whole objects. Never log PII beyond `userId`.
- **Enums:** prefer union types in the registry; adapters can map them
  to provider taxonomies.

### Choosing a backend

| Env value                         | Adapter               |
| --------------------------------- | --------------------- |
| `VITE_ANALYTICS_BACKEND=amplitude`| Amplitude HTTP V2     |
| `VITE_ANALYTICS_BACKEND=posthog`  | PostHog capture       |
| `VITE_ANALYTICS_BACKEND=console`  | Console (dev default) |
| unset (prod)                      | No-op                 |

Additional env vars:

- `VITE_AMPLITUDE_API_KEY` — required for the Amplitude adapter.
- `VITE_POSTHOG_API_KEY` / `VITE_POSTHOG_HOST` — required for PostHog.

---

## 3. Logging

Get a module-scoped logger with `logger.child`:

```ts
import { logger } from '@/lib/observability/logger'

const log = logger.child({ component: 'PulseService' })

log.info('creating pulse', { userId, action: 'pulse.create' })

try {
  await api.createPulse(payload)
} catch (err) {
  log.error('pulse creation failed', { userId, action: 'pulse.create', err })
}
```

### Levels

| Level | When to use                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------- |
| debug | Verbose traces; off in prod unless `VITE_LOG_LEVEL=debug` is set                                |
| info  | Normal business events worth an audit trail                                                     |
| warn  | Degraded but recoverable; auto-sent to Sentry as a breadcrumb                                   |
| error | User-visible failure; sent as Sentry `captureException` or `captureMessage` + breadcrumb + HTTP |

### Fields

Always pass the following when they apply:

- `userId` — authenticated user
- `sessionId` — automatically populated from `getSessionId()`
- `route` — pathname (the `useTrack` hook fills this in for you)
- `action` — semantic action tag, e.g. `pulse.create`, `venue.fetch`
- `correlationId` — thread an id through a multi-step flow
- `requestId` — outbound fetch id, for stitching with backend logs
- `component` — module or React component name

### Sinks

- **Console** — enabled in dev only; rich object payloads.
- **Sentry** — `warn`+ become breadcrumbs; `error` is also captured.
- **HTTP** — set `VITE_LOG_SINK_URL` to POST every log entry to a
  collector (Logtail, Datadog, Axiom, custom). Uses `sendBeacon` on
  unload for best-effort delivery.

Add new sinks via `registerSink({ name, write })`.

### Timing helper

```ts
import { withTiming } from '@/lib/observability/logger'

await withTiming('pulse.create', () => api.createPulse(payload), {
  userId,
  component: 'PulseService',
})
```

Emits an `info` line with `durationMs` on success; `error` with the
error + duration on failure.

---

## 4. Web Vitals

Web vitals are captured via `initWebVitals()` (LCP, FID, CLS, INP,
TTFB, FCP) and forwarded to the logger + Sentry measurements.

To enable, call `initWebVitals()` once in your bootstrap (e.g. at the
bottom of `main.tsx`). The module is a no-op until invoked. This file
deliberately does not auto-start so existing bootstrap code stays
unchanged.

Thresholds follow the official Core Web Vitals ratings. `poor` ratings
are logged at `warn`, which lands in Sentry as a breadcrumb so you can
correlate perf regressions with errors.

---

## 5. Alerting — what to configure

### Sentry issue alerts

Configure in Sentry > Alerts > Create Alert. Recommended rules:

1. **New issue, any environment: prod**
   - Trigger: a new issue is created
   - Filter: environment equals `production`
   - Action: Slack `#pulse-alerts`, PagerDuty `on-call-primary`
2. **Regression**
   - Trigger: a resolved issue becomes unresolved
   - Action: Slack `#pulse-alerts`
3. **Spike in error rate**
   - Metric: number of errors > 50 in 5 min (tune after 2 weeks of data)
   - Action: PagerDuty `on-call-primary`
4. **High-severity transaction anomaly**
   - Metric: p95 transaction duration for `/pulse-create` > 3s for 10 min
   - Action: Slack `#pulse-perf`

### Uptime checks

Add an external probe (Better Uptime / Pingdom / UptimeRobot) against:

- `https://pulse.app/` — expect 200, content includes `<title>Pulse`
- `https://pulse.app/api/health` — once the health route is added
- `https://pulse.app/manifest.webmanifest` — catches build regressions

Probe interval: 60s. SLO: 99.9% monthly. Page on 3 consecutive failures.

### Performance regression alerts

- Vercel Speed Insights: set budgets for LCP (2.5s), INP (200ms), CLS
  (0.1). Alert on 7-day p75 crossing `needs-improvement`.
- Lighthouse CI (`lighthouserc.json`): enforce the existing budgets in
  PR CI. Any regression fails the build.

### Log-based alerts

If `VITE_LOG_SINK_URL` points to Logtail / Datadog, add:

- `level:error` count > 10 / 5 min → Slack `#pulse-alerts`
- `action:pulse.create AND level:error` count > 5 / 5 min → page
- Any log with `action:checkout.*` AND `level:error` → page

---

## 6. On-call Runbook Skeleton

> The full incident playbook lives in
> [`incident-response.md`](./incident-response.md). This section is a
> fast-reference card for the person wearing the pager.

### First 5 minutes

1. **Acknowledge** the page. Drop a note in `#pulse-incidents`.
2. **Confirm impact**: is the app down, degraded, or is it a single
   feature? Open the Sentry issue + Vercel status + uptime probe.
3. **Declare severity** (see `incident-response.md` for the matrix).
4. **Create an incident doc** from the template.

### Diagnosis loop

- Sentry: issue frequency, affected releases, device breakdown.
- Vercel: latest deployment, function logs, build status.
- Supabase: project status page, DB CPU, connection count.
- Log sink: search `level:error AND action:<suspect>`.
- Roll back if the incident started within 30 min of a deploy and the
  suspect release is obvious.

### Mitigation menu

| Symptom                      | First try                                                                |
| ---------------------------- | ------------------------------------------------------------------------ |
| Spike tied to latest deploy  | `vercel rollback` to the previous production deployment                  |
| Supabase saturated           | Enable read-only mode via feature flag; pause non-critical backfills     |
| Third-party API failing      | Flip the associated feature flag off; cached data keeps core loop alive  |
| Perf regression, no errors   | Flag off expensive feature; open perf ticket                             |
| Error but feature non-core   | Flag off the feature; ship a fix in the next deploy                      |

### Communications cadence

- **Sev 1**: status page update within 15 min, then every 30 min.
- **Sev 2**: status page within 30 min, then every hour.
- **Sev 3**: internal only, update the ticket.

See `incident-response.md` for templates.

### Closing out

1. Mark the incident resolved in the status page.
2. Open the post-mortem doc within 24h.
3. File follow-up tickets tagged `post-incident`.
4. Schedule review within 5 business days.

---

## 7. Local Development Tips

- Set `VITE_LOG_LEVEL=debug` in `.env.local` to see every log line.
- Set `VITE_ANALYTICS_BACKEND=console` to see `track()` calls in the
  browser console without shipping to a real backend.
- `window.__obs` is not exposed — add a debug hook yourself if you need
  to introspect the logger at runtime.

---

## 8. Privacy Checklist

Before adding any new field to a log or analytics payload, confirm:

- [ ] No raw email, phone, or address in the props.
- [ ] No free-form user-generated content (pulse captions, chat).
- [ ] User IDs are opaque (not emails).
- [ ] Location data is coarsened (neighborhood, not coordinates).
- [ ] The new field is documented in this file.
