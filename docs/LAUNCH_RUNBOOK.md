# Pulse Launch Runbook

> **Who is this for?** The engineer or on-call person responsible for deploying and monitoring the Pulse production launch.
>
> **Last updated:** 2026-03-28

---

## Pre-Launch Checklist

Complete every item before promoting to production.

### Code Quality
- [ ] All CI checks pass green (lint, test, build, audit)
- [ ] Zero ESLint errors with `--max-warnings 0`
- [ ] Test coverage ≥ 80 % on critical paths (analytics, feature-flags, offline-queue)
- [ ] Bundle size within budget: total JS ≤ 1,500 KB (enforced by CI)
- [ ] `npm audit --audit-level=high` passes with zero high/critical findings
- [ ] Lighthouse CI scores: Performance ≥ 0.80, Accessibility ≥ 0.95, Best Practices ≥ 0.90

### Infrastructure
- [ ] Staging environment verified end-to-end
- [ ] Database migrations applied to production (via Supabase migration runner)
- [ ] Row Level Security (RLS) policies enabled and tested on all tables
- [ ] Supabase Realtime enabled for `pulses` and `venue_scores` tables
- [ ] Supabase Storage buckets configured with correct access policies
- [ ] Supabase Auth configured: email OTP, provider allowlist set
- [ ] Supabase Edge Functions deployed and tested in production project

### Environment Variables
Set all required variables in Vercel before deploying:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | Yes |
| `VITE_SENTRY_DSN` | Sentry project DSN | Yes |
| `VITE_APP_VERSION` | App version string for Sentry releases (e.g. `1.0.0`) | Yes |
| `VITE_FF_*` | Feature flag overrides (see feature-flags.ts for names) | No |

- [ ] All required variables are set in Vercel → Project → Settings → Environment Variables
- [ ] Variables are scoped to the correct environment (production / preview)
- [ ] No secrets committed to the repository

### App Configuration
- [ ] Sentry DSN configured and error boundary tested in staging
- [ ] PWA manifest verified: icons (512×512, 192×192), name, short_name, description, theme_color
- [ ] Service worker registers and precaches correctly on staging
- [ ] `robots.txt` and `sitemap.xml` are present and correct
- [ ] Domain configured with SSL certificate (auto-managed by Vercel)
- [ ] Custom domain DNS records pointing to Vercel
- [ ] HTTPS enforced (no HTTP fallback)

### Feature Flags
Set flags to their intended launch defaults via `VITE_FF_*` env vars or by updating `DEFAULT_FLAGS` in `src/lib/feature-flags.ts`:

| Flag | Launch Default | Notes |
|------|---------------|-------|
| `smartMap` | `true` | Core discovery feature |
| `stories` | `true` | Core social feature |
| `crews` | `true` | Core social feature |
| `events` | `true` | Core venue feature |
| `achievements` | `true` | Engagement feature |
| `offlineMode` | `true` | PWA feature |
| `realtimeScores` | `true` | Core realtime feature |
| `integrations` | `false` | Post-launch rollout |
| `socialDashboard` | `false` | Post-launch rollout |
| `nightPlanner` | `false` | Post-launch rollout |
| `venueOwnerDashboard` | `false` | Post-launch rollout |
| `creatorEconomy` | `false` | Post-launch rollout |
| `pushNotifications` | `false` | Requires additional setup |
| `videoUploads` | `false` (25% rollout) | Gradual rollout when ready |

### Legal & Policy
- [ ] Privacy Policy page live at `/privacy`
- [ ] Terms of Service page live at `/terms`
- [ ] Age verification (18+) gating present on signup
- [ ] GDPR consent collected at onboarding (EU users)
- [ ] Data export flow tested end-to-end
- [ ] Account deletion flow tested end-to-end
- [ ] CCPA "Do Not Sell" mechanism in place

---

## Deployment Steps

### 1. Prepare Release Branch

```bash
git checkout main
git pull origin main
git checkout -b release/v1.0.0
```

### 2. Run Local Release Check

```bash
npm run release-check
# Runs: lint (--max-warnings 0) + test + build + audit
```

Fix any failures before proceeding.

### 3. Verify Bundle Size

```bash
npm run build
# Check dist/assets/ — total JS should be ≤ 1,500 KB
ls -lh dist/assets/*.js | awk '{sum += $5} END {print "Total JS:", sum/1024/1024, "MB"}'
```

### 4. Tag the Release

```bash
git tag v1.0.0 -m "Production launch v1.0.0"
git push origin release/v1.0.0 --tags
```

### 5. Deploy to Staging

1. Go to **GitHub → Actions → Deploy**
2. Click **Run workflow**
3. Set `target` = `preview`
4. Wait for workflow to complete (≈ 5 min)

### 6. Verify Staging Deployment

Run through the critical user flows on the staging URL:

- [ ] App loads without errors (check browser console)
- [ ] Onboarding flow completes
- [ ] Map loads and shows venues
- [ ] Venue detail page opens
- [ ] Pulse creation and submission work
- [ ] Check-in flow works
- [ ] Push notification permission prompt (if enabled)
- [ ] Privacy Policy and Terms of Service pages render correctly
- [ ] Data export downloads a valid JSON file
- [ ] Account deletion flow shows confirmation dialog

### 7. Deploy to Production

1. Go to **GitHub → Actions → Deploy**
2. Click **Run workflow**
3. Set `target` = `production`
4. **Manual approval required** — a team lead must approve the deployment in GitHub
5. Wait for workflow to complete and the health check to pass

### 8. Verify Production Deployment

Immediately after deployment:

- [ ] Production URL loads (no 404 / blank screen)
- [ ] Sentry shows the new release version
- [ ] Vercel Analytics shows traffic
- [ ] No new error spikes in Sentry (watch for 15 min)
- [ ] Supabase dashboard shows connections from production

### 9. Post-Deploy Monitoring Window

Monitor for 30 minutes after launch:

| Check | Tool | Threshold |
|-------|------|-----------|
| Error rate | Sentry | < 1% of sessions |
| P95 load time | Vercel Analytics | < 3 s |
| Database query time | Supabase Dashboard | < 500 ms avg |
| Active connections | Supabase Dashboard | Below pool limit |

---

## Rollback Procedure

Use this when production is broken and a fix cannot be deployed quickly.

### Via Vercel Dashboard (Fastest)

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → select the Pulse project
2. Navigate to **Deployments**
3. Find the last known-good deployment (green status, prior to the broken deploy)
4. Click **⋯ → Promote to Production**
5. Confirm the promotion
6. Verify the rollback at the production URL (< 1 min for DNS propagation)
7. Check Sentry — error rate should drop immediately

### Via Git (if Vercel rollback is unavailable)

```bash
git revert <commit-sha>    # Create a revert commit
git push origin main       # Triggers auto-deploy
```

### Database Rollback

Only needed if a migration caused data corruption or schema breakage:

1. Go to **Supabase Dashboard → Database → Backups**
2. Select the PITR snapshot from before the migration
3. Click **Restore**

> **Warning:** PITR restores affect all tables. Notify the team before restoring to avoid overwriting recent legitimate data.

---

## Incident Response

### Severity Levels

| Level | Name | Definition | Response Time |
|-------|------|-----------|---------------|
| **P0** | Critical | App completely down or data loss | Immediate rollback |
| **P1** | High | Major feature broken, auth issues, data leak | Hot-fix within 2 hours |
| **P2** | Medium | Minor feature broken, degraded UX, non-critical error spike | Fix in next release |
| **P3** | Low | Cosmetic bug, typo, non-user-facing issue | Backlog |

### P0 / P1 On-Call Checklist

1. **Confirm** — reproduce the issue yourself before escalating
2. **Check Sentry** — look for new error groups or a sharp increase in error volume
3. **Check Vercel** — confirm the deployment is healthy (green) and the correct version is live
4. **Check Supabase** — verify database, auth, and realtime services are operational
5. **Decide** — rollback vs. hot-fix
   - Rollback: use Vercel promote (< 2 min)
   - Hot-fix: branch from main, minimal fix, fast-track CI, deploy
6. **Communicate** — update team channel with status and ETA
7. **Document** — write a brief incident summary (cause, impact, timeline, fix, prevention)

### Communication Template

```
[Pulse Incident] P{level} — {short description}

Status: Investigating / Mitigating / Resolved
Impact: {who is affected and how}
Started: {time}
Update: {what we know so far / what action is being taken}
Next update: {time}
```

---

## Monitoring Dashboards

| Dashboard | Purpose | URL |
|-----------|---------|-----|
| Sentry | Error tracking, crash reports | https://sentry.io/organizations/[your-org]/projects/pulse/ |
| Vercel Analytics | Page views, performance, visitors | https://vercel.com/[your-team]/pulse/analytics |
| Vercel Deployments | Deploy history and status | https://vercel.com/[your-team]/pulse/deployments |
| Supabase Dashboard | Database, auth, realtime, storage | https://supabase.com/dashboard/project/[project-ref] |
| Lighthouse CI | Performance & accessibility scores | GitHub Actions tab → lighthouse.yml |

---

## Critical User Flows (Smoke Test Checklist)

Run these manually or via Playwright after every production deploy:

1. **Load** — App loads at production URL in < 3 seconds on 4G throttling
2. **Discover** — Map renders with venue pins within 5 seconds
3. **Venue** — Tapping a venue opens the detail page with score and recent pulses
4. **Pulse** — Submitting an energy rating creates a pulse and updates the venue score
5. **Auth** — Sign up and sign in flows complete without error
6. **Offline** — Disconnecting network shows offline indicator; reconnecting syncs queued actions
7. **Privacy** — `/privacy` and `/terms` pages load and render correctly
8. **Data Export** — Settings → Export data downloads a non-empty JSON file

---

## Common Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| Blank screen on load | Build error or missing JS chunk | Check Vercel build logs; verify env vars |
| Venues not loading | Supabase connection or RLS policy | Check Supabase status; verify `VITE_SUPABASE_URL` |
| Pulse creation fails silently | Auth session expired or RLS | Check Sentry for specific error; verify auth config |
| Map not rendering | Missing API key or CORS | Verify environment variables in Vercel |
| Offline queue not syncing | Service worker error | Clear SW cache, check offline-queue.ts error log |
| Sentry not receiving errors | Missing DSN or wrong environment | Verify `VITE_SENTRY_DSN` in Vercel env vars |
| Feature flag not working | Env var name mismatch | Use format `VITE_FF_<SCREAMING_SNAKE_CASE>` (e.g. `VITE_FF_CREWS`) |
| High error rate after deploy | Bad deploy | Roll back immediately via Vercel promote |

---

## References

- [PRODUCTION_ROLLOUT.md](../PRODUCTION_ROLLOUT.md) — phased rollout plan
- [docs/SUPPORT_RUNBOOK.md](SUPPORT_RUNBOOK.md) — operational support procedures
- [RELEASE_CHECKS.md](../RELEASE_CHECKS.md) — pre-deployment checks
- [SECURITY.md](../SECURITY.md) — security policy and priorities
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system architecture overview
- [src/lib/feature-flags.ts](../src/lib/feature-flags.ts) — feature flag definitions
