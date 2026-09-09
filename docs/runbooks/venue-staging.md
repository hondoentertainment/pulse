# Runbook: Venue staging and production checks

## Purpose

Confirm the nightlife venue + map shell is what every environment mounts. Pulse is venue-only; there is no Signal product flag.

## Preconditions

- Preview or production deploy of this repo
- Optional: `VITE_LAUNCHED_CITIES=Seattle,WA` if exercising the geo-gate

## Procedure

1. Open production / preview. The HTML title should be **Pulse — where the energy is right now** and the first surface should be map / discover.
2. Confirm there is no Pulse Signal Today / check-in shell, and no `VITE_APP_MODE` env var is required.
3. Exercise the nightlife loop: map → venue → pulse → trending.
4. Local:

```bash
npm run dev
npm run test:smoke:venue
```

## Verification

- [ ] App boots the venue shell with no mode switch
- [ ] Title matches Pulse nightlife copy
- [ ] CI `smoke-preview` follows `smoke-preview-venue`
- [ ] `VITE_LAUNCHED_CITIES` (if set) only gates venue markets

## Rollback / Escalation

- If a deploy is fixture-only, set `VITE_SUPABASE_*` and rebuild.
- If the map or pulse loop is broken, roll back the deploy ([bad-deploy](bad-deploy.md)).

## Ownership

- Owner: Pulse venue engineer
- Last reviewed: 2026-09-09
