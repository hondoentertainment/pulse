# Runbook: Auth redirect URLs (magic link + OAuth)

## Purpose

Keep Pulse magic-link and Google OAuth emails pointing at the live app, not
`http://localhost:3000`. Trigger this when a confirm/signup email's
`redirect_to` is localhost, the link shows `ERR_CONNECTION_REFUSED`, or
"I'm here still" returns the guest to `/auth`.

## Preconditions

- Supabase Dashboard access for project `xeldqwhztcnnvazmshzh`
- Production host: `https://pulse-chi-nine.vercel.app`
- Client already sends `window.location.origin` via `authRedirectBaseUrl()`
  (`src/lib/auth-redirect.ts`). No `SUPABASE_SERVICE_ROLE_KEY` required.

## Procedure

1. Open **Supabase → Authentication → URL Configuration**.
2. Set **Site URL** to `https://pulse-chi-nine.vercel.app` (production),
   not `http://localhost:3000`.
3. Add these **Additional Redirect URLs** (wildcards allowed):
   - `https://pulse-chi-nine.vercel.app/**`
   - `https://*.vercel.app/**` (optional; preview deploys)
   - `http://localhost:3000/**` (local `npm run dev` only)
4. Save. New magic links pick up the allowlist immediately; already-sent
   mail still has the old `redirect_to`.

If the requested `emailRedirectTo` / `redirectTo` is missing from this
list, GoTrue silently substitutes **Site URL** — that is how prod mail
ended up at `http://localhost:3000`.

## Verification

- [ ] From https://pulse-chi-nine.vercel.app/auth, send a magic link.
- [ ] The email (or its confirm URL) has `redirect_to=https://pulse-chi-nine.vercel.app` (no localhost).
- [ ] Opening the link signs the guest in; "I'm here still" does not bounce to `/auth`.
- [ ] Google OAuth returns to the same origin.

## Rollback / Escalation

- Revert the Pulse deploy if `authRedirectBaseUrl` was changed incorrectly.
- Do **not** put Site URL back to localhost to "fix local" — keep localhost
  only in Additional Redirect URLs.
- Stop if you do not have dashboard access; escalate to the project owner.
  Do not paste service-role keys into the browser.

## Ownership

- Owner: On-call engineer
- Last reviewed: 2026-09-11
