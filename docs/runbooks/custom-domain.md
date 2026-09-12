# Custom domain + branded magic-link

## Purpose

Attach a first-party origin later and brand Supabase auth mail so guests
never see `localhost` or the current Vercel preview host in user-facing
email. **Do not buy a domain or change Vercel DNS from this runbook.**
A human still attaches the domain when it exists.

Live production URL today: `https://pulse-chi-nine.vercel.app/`.

## Preconditions

- Vercel project for Pulse (current prod: `pulse-chi-nine`)
- Supabase project `xeldqwhztcnnvazmshzh`
- Dashboard access for Authentication → URL Configuration and Email Templates
- The future origin (example placeholder only): `https://<your-domain>/`
- This runbook does **not** invent or purchase that domain

## Procedure

### 1. Keep the live origin working

Until a custom domain is attached, Site URL and magic-link redirects stay
on `https://pulse-chi-nine.vercel.app`. See
[Auth redirect URLs](auth-redirect-urls.md).

### 2. Vercel domain attach (human, later)

When the domain exists:

1. Vercel → Project → Settings → Domains → Add.
2. Follow Vercel’s DNS instructions at the registrar. Do **not** edit
   Pulse DNS from CI or this agent.
3. Confirm HTTPS on `https://<your-domain>/` before changing Supabase.

### 3. Supabase Site URL + Additional Redirect URLs

Open **Authentication → URL Configuration** on `xeldqwhztcnnvazmshzh`.

**Site URL** (after the custom origin is live):

- `https://<your-domain>`

**Additional Redirect URLs** (keep all that you still use):

- `https://<your-domain>/**`
- `https://pulse-chi-nine.vercel.app/**` (current live URL — keep until
  traffic fully moves)
- `http://localhost:5173/**` and `http://127.0.0.1:5173/**` (local Vite)
- Exact preview origins only when you need them. Do **not** add
  `https://*.vercel.app/**`.

If `emailRedirectTo` / `redirectTo` is missing from this list, GoTrue
substitutes **Site URL**. That is how mail previously pointed at
localhost.

### 4. Branded Supabase email templates

Authentication → Email Templates (magic link, OTP, confirm signup,
recovery). Once the custom domain exists:

- Use the custom origin in every button / confirm URL.
- Do **not** mention `localhost` in user-facing copy.
- Do **not** mention `pulse-chi-nine` in user-facing copy.
- Keep sender name **Pulse** (or the live product name).

Until the custom domain is attached, templates may still use
`https://pulse-chi-nine.vercel.app` so links work. That host is the
documented live URL, not a secret.

## Verification

- [ ] https://pulse-chi-nine.vercel.app/ still loads (current prod)
- [ ] After attach: `https://<your-domain>/` serves the same app
- [ ] Site URL matches the origin guests will click in mail
- [ ] Additional Redirect URLs include the custom origin `/**` and the
      current Vercel origin until cutover is done
- [ ] A new magic-link email has no `localhost` and, after cutover, no
      `pulse-chi-nine` in the visible body
- [ ] Confirm URL `redirect_to` matches the intended origin

## Rollback / Escalation

- Set Site URL back to `https://pulse-chi-nine.vercel.app`
- Keep that origin on Additional Redirect URLs so already-sent mail
  still works
- Do **not** delete catalog venues or invent admin users to test mail
- Escalate if Vercel domain verification fails — registrar DNS is human

## Ownership

- Owner: Pulse ops / auth
- Last reviewed: 2026-09-12
