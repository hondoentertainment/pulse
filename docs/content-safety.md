# Content Safety

This document describes how Pulse enforces content safety, what threats we
defend against, and how on-call can tune or audit the system.

## Threat Model

**Assets we protect:**

- Other users from harassment, spam, scams, and PII leaks.
- Venues from defamation and fake reviews.
- The platform from regulatory / trust-and-safety risk.

**Actors:**

- **Casual user** — accepts client-side warnings, retypes content.
- **Motivated spammer** — disables JS, scripts direct API calls, rotates
  accounts.
- **Malicious insider (former employee)** — has access to staging creds but
  not prod service-role keys.

**Assumptions:**

- Any code running in `src/` is visible to and modifiable by the user.
- `api/` code runs server-side on Vercel and cannot be modified by users.
- Supabase RLS policies are the final authorization gate on every write.

## Enforcement Layers

```
                       User action
                           |
                           v
+---------- CLIENT (browser, untrusted) ----------+
| src/lib/content-moderation.ts                    |
|   -> instant visual feedback only                |
| src/lib/moderation-client.ts                     |
|   -> `moderateServer()` wraps the POST below     |
+--------------------------------------------------+
                           |
                           v
+---------- SERVER (Vercel Edge, trusted) --------+
| api/moderation/check.ts     <- public endpoint  |
| api/pulses/create.ts        <- write endpoint   |
|   both call -> api/_lib/moderation.checkContent |
|   both apply -> api/_lib/rate-limit.consume     |
|   both require -> api/_lib/auth.requireAuth     |
+--------------------------------------------------+
                           |
                           v
+---------- DATABASE (Supabase, trusted) ---------+
| RLS policies in                                  |
|   supabase/migrations/*_rls_policies_*.sql       |
|   -> final authorization check on every write   |
+--------------------------------------------------+
```

| Layer | What it enforces | What it does NOT enforce |
|---|---|---|
| Client (`src/lib/content-moderation.ts`) | UX hints (red border, warnings) | Nothing authoritative |
| Client wrapper (`src/lib/moderation-client.ts`) | Nothing — it forwards to server | Nothing authoritative |
| Edge (`api/moderation/check.ts`) | Rate limiting, auth, content rules | Database authorization |
| Edge (`api/pulses/create.ts`) | Rate limiting, auth, content rules, shape validation, inline re-check | Database authorization |
| Database (RLS) | Row ownership, visibility | Content semantics |

The important invariant: **no write path trusts the client-side check**. Even
if `api/moderation/check.ts` is skipped by a malicious client, the write
endpoint calls `checkContent` inline before inserting.

## Endpoints

### `POST /api/moderation/check`

Request:
```json
{ "content": "…", "kind": "pulse|comment|profile_bio|venue_description" }
```

Response (200):
```json
{
  "data": {
    "allowed": true,
    "reasons": [],
    "severity": "low",
    "sanitized": "…"
  }
}
```

Requires `Authorization: Bearer <supabase-jwt>`.
Rate-limited to 60/min per user (bucket `moderation_check`).

### `POST /api/pulses/create`

Request body is a pulse draft. Caption is moderated inline. On rejection,
returns 400 with `error.reasons`. On success, returns 201 with the persisted
row.

Rate-limited to 10/hour per user (bucket `pulse_create`).

## What's Detected

Rules live in `api/_lib/moderation.ts`.

- **Banned words/phrases** — case-insensitive, word-boundary matched.
- **PII** — email addresses (all kinds), phone numbers (all kinds except
  `venue_description` where a business phone is legitimate).
- **URLs** — allowlist of known-safe hosts; non-allowlisted are flagged at
  `med` severity; high-risk TLDs (`.ru`, `.tk`, `.xyz`, etc.) at `high`.
- **Spam heuristics** — too many links, excessive uppercase, repeated
  characters.
- **Length** — per-kind max/min.

### Severity mapping to action

| Severity | Action |
|---|---|
| `low` | Warn the user, still allow the write. |
| `med` | Block the write, show reasons. |
| `high` | Block the write, show reasons, consider flagging the account (future follow-up). |

## How to Tune the Word List

1. Open `api/_lib/moderation.ts`.
2. Add or remove entries from `BANNED_WORDS`. Prefer commenting out over
   deleting so the audit trail survives.
3. If the entry is a multi-word phrase, no extra escaping is needed — the
   regex builder handles it.
4. Add a test case in
   `src/lib/__tests__/server-moderation.test.ts`.
5. Deploy.

### Adjusting URL allowlist

- **Allowlist** lives in `URL_ALLOWLIST` in `api/_lib/moderation.ts`. Add the
  registrable domain without `www.`; subdomains are matched automatically.
- **High-risk TLD list** lives in `HIGH_RISK_TLDS`. Only add TLDs that have
  statistically disproportionate abuse — do not block entire countries.

### Adjusting rate limits

Buckets are named constants in `api/_lib/rate-limit.ts` under
`RATE_LIMITS`. Each bucket has `maxTokens`, `refillRate` (tokens per second),
and a diagnostic `windowMs`. To add a new bucket, append an entry and
reference it by key from the endpoint with `consume(userId, 'bucket_name')`.

## How to Audit Blocked Content

Today we log to `console.error` in Edge Functions; in a production environment
these surface in Vercel logs. To investigate a block:

1. Ask the user for the approximate timestamp.
2. Pull Vercel logs for `/api/moderation/check` or `/api/pulses/create`
   around that time.
3. The `error.reasons` array is included in 400 responses and mirrors what
   the user would have seen.

**Follow-up for production**: ship a `moderation_events` table that stores
`(user_id, kind, sanitized_content, reasons, severity, created_at)` so
trust-and-safety can audit without grepping logs. Out of scope for this PR.

## Migration Path: Components → Server Enforcement

Today every UI component that accepts user input calls the local
`screenContent()` from `src/lib/content-moderation.ts`. To harden:

1. **Add the wrapper call.** Before submitting, call
   `await moderateServer(content, kind)`. Render `reasons`/`severity`
   identically to how `screenContent` is rendered.
2. **Keep the client-side check.** It still drives the typing-time red border
   — do not remove it, but treat its output as advisory.
3. **Short-circuit writes when `allowed === false`.** Disable the submit
   button and surface the first reason inline.
4. **Move actual writes to the hardened endpoints** — e.g. `POST
   /api/pulses/create` instead of direct `supabase.from('pulses').insert(…)`.
   This is the step that closes the bypass.

A component-by-component rollout is the follow-up PR. This PR intentionally
does NOT change any components.

## Supabase Client Choice (User JWT vs Service Role)

`api/_lib/supabase-server.ts#createUserClient` uses the caller's JWT, not the
service role key. Rationale:

- Service role bypasses RLS — a bug could leak data across users.
- Passing the JWT keeps RLS policies in force at the DB layer, giving us a
  second gate even if validation has a bug.
- If a future job genuinely needs elevated privileges (backfills, cron),
  add a clearly-named `createAdminClient()` in the same file and use it only
  from non-user-facing code paths.

Environment variables honoured (in order): `SUPABASE_URL` /
`VITE_SUPABASE_URL`, then `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`.
Placeholders are used when absent so local dev does not crash; writes will
fail loudly with a 500 including Supabase's error message.
