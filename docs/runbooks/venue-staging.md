# Runbook: Venue (shipping default) and Signal flag

## Purpose

Confirm the nightlife venue + map shell is what production mounts, and exercise Pulse Signal only when explicitly flagged.

## Preconditions

- Vercel project admin access
- Production should **unset** `VITE_APP_MODE` or set `VITE_APP_MODE=venue`
- Do **not** set production `VITE_APP_MODE=signal` unless intentionally shipping Signal

## Procedure

1. Production / Preview without `VITE_APP_MODE` (or with `venue`) should title **Pulse** and show map / discover — not Pulse Signal Today.
2. To run Signal on a preview only:
   - `VITE_APP_MODE=signal`
   - Redeploy so `VITE_*` values bake in.
3. Optional venue geo-gate: `VITE_LAUNCHED_CITIES=Seattle,WA`
4. Venue Supabase vars if you are testing persistence.

Local venue (default):

```bash
npm run dev
```

Local Signal:

```bash
VITE_APP_MODE=signal npm run dev
```

## Verification

- [ ] Unset `VITE_APP_MODE` resolves to venue (`src/lib/app-mode.ts`)
- [ ] Production / default preview shows the venue shell (map home)
- [ ] `VITE_APP_MODE=signal` still mounts Signal
- [ ] CI `smoke-preview` follows venue smoke; Signal smoke stays runnable under signal mode

## Rollback / Escalation

- To revert a mistaken Signal production flag: unset `VITE_APP_MODE` or set `venue` and redeploy.
- To temporarily restore Signal as the live shell: set production `VITE_APP_MODE=signal` (product decision — do not do this casually).

## Ownership

- Owner: Venue product engineer
- Last reviewed: 2026-09-09
