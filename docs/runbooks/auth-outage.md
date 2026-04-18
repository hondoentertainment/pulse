# Runbook: Auth Outage

**Severity default:** SEV-1 — unauthenticated users cannot sign in, authenticated users cannot refresh tokens.

**Primary owner:** On-call engineer.

## 1. Detection

- Sentry: `AuthApiError` / `GoTrueApiError` / `refresh_token_not_found` spike.
- Supabase status page → "Auth" red/yellow.
- Vercel: 401s on protected routes spike.
- Synthetic: `auth-sign-in` Checkly failing.

**Confirm in < 2 min:**

```bash
# Attempt an anonymous session call — should return a session payload with 200.
curl -sS -o /dev/null -w '%{http_code}\n' \
  "https://<PROJECT_REF>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"probe@pulseapp.example","password":"<probe-pw>"}'
```

Any 5xx → confirmed outage. 400 with a sensible error message → Auth is up.

## 2. Triage (first 3 min)

1. Declare in `#incidents`:
   ```
   /incident declare sev1 "Supabase Auth outage — sign-in / refresh failing"
   ```
2. Update status page:
   > "Sign-in is currently failing. Already-signed-in users may continue to browse but check-ins and posting may fail. Updates in 15 min."
3. Check whether the outage is Supabase-wide (status page) or isolated to our project (dashboard).

## 3. Mitigation — Graceful Degradation

Pulse's auth model lets us degrade to anonymous browsing while Auth is down. Flip the flag:

```bash
vercel env add PULSE_AUTH_DEGRADED_MODE true production
vercel --prod --force
```

Effects (wired in `src/lib/auth.ts` + `useAuth`):

- Anonymous users: read-only, same as a logged-out visitor today.
- Signed-in users with a non-expired JWT in localStorage: continue using the app; writes succeed against RLS (JWT still valid until natural expiry).
- Signed-in users with an expired JWT: app stops attempting refresh, shows a banner "Sign-in is temporarily unavailable — you can continue browsing but can't post right now."
- Pulse creation and check-in buttons are disabled for expired/anonymous sessions, with the banner explaining.

### Don't do this

- Do **not** lower JWT expiry / rotate signing keys during an Auth outage — you'll invalidate every session and make recovery harder.
- Do **not** manually issue tokens via the service role key to bypass — opens a security hole.

## 4. Recovery

1. Wait for Supabase Auth green on status page + 5 min clean synthetics.
2. Disable degraded mode:
   ```bash
   vercel env rm PULSE_AUTH_DEGRADED_MODE production
   vercel --prod --force
   ```
3. Verify fresh sign-in works:
   ```bash
   # from an incognito window, sign in with the probe account
   ```
4. Watch Sentry for any lingering `refresh_token_not_found` — these should converge as clients naturally re-auth.

## 5. Communications Template

**During:**
```
[14:15 UTC] Sign-in is currently failing due to an issue with our auth
provider. If you're already signed in, you can keep using the app in
read-only mode. Next update at 14:45 UTC.
```

**All-clear:**
```
[15:00 UTC] Sign-in is working again. If you're still seeing an error, try
closing and reopening the app. Thanks for your patience.
```

## 6. Post-incident

- Verify the auth-degraded-mode code path — if it misbehaved, open a Linear ticket.
- Review any security implications of expired JWTs succeeding during the window.
- If Supabase Auth outages become frequent, evaluate a dedicated Auth fallback (e.g. cached user profile for read-only access, with periodic re-auth attempts in the background).
