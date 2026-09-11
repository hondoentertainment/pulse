/**
 * Browser origin used for magic-link (`emailRedirectTo`) and Google OAuth
 * (`redirectTo`). Never hardcode `http://localhost:3000` — GoTrue emails
 * inherit Site URL when this is omitted or not allowlisted.
 *
 * Supabase Dashboard → Authentication → URL Configuration:
 *   Site URL + Additional Redirect URLs must include
 *   `https://pulse-chi-nine.vercel.app/**`
 * (plus local `http://localhost:3000/**` for `npm run dev`).
 *
 * There is no dedicated auth callback route; `detectSessionInUrl` consumes
 * the tokens on whatever page the user lands, so origin (no `/auth` path)
 * is the allowlist-safe target.
 *
 * @see docs/runbooks/auth-redirect-urls.md
 */
export function authRedirectBaseUrl(
  location: Pick<Location, 'origin'> | null | undefined = typeof window !== 'undefined'
    ? window.location
    : null,
): string {
  const origin = location?.origin
  if (!origin || typeof origin !== 'string') return ''
  return origin.replace(/\/$/, '')
}
