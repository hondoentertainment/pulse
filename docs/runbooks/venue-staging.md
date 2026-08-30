# Runbook: Venue staging (flag-gated only)

## Purpose

Exercise the nightlife venue PWA without changing the production default. Pulse Signal stays the shipping product.

## Preconditions

- Vercel project admin access
- Do **not** set production `VITE_APP_MODE=venue`
- Do **not** merge a default-mode flip (rejected pattern from #44)

## Procedure

1. Create or reuse a **Preview** environment (branch deploy is enough).
2. Set Preview-only env:
   - `VITE_APP_MODE=venue`
   - optional `VITE_LAUNCHED_CITIES=Seattle,WA`
   - venue Supabase vars if you are testing persistence
3. Redeploy the preview so `VITE_*` values bake in.
4. Confirm production https://pulse-chi-nine.vercel.app/ still titles **Pulse Signal**.
5. Confirm the preview shows the venue shell (map / discover), not Signal Today.

Local equivalent:

```bash
VITE_APP_MODE=venue VITE_LAUNCHED_CITIES=Seattle,WA npm run dev
```

## Verification

- [ ] Production default remains Signal
- [ ] Preview/local venue mode does not change `src/lib/app-mode.ts` default
- [ ] CI `smoke-preview-venue` stays advisory (`continue-on-error`)
- [ ] Required GitHub check is Signal (`smoke-preview` alias or `smoke-preview-signal`)

## Rollback / Escalation

- Unset Preview `VITE_APP_MODE` or set it back to `signal`.
- If production ever ships venue by mistake, revert the deploy and restore `VITE_APP_MODE=signal` (or unset).

## Ownership

- Owner: Signal product engineer
- Last reviewed: 2026-08-30
