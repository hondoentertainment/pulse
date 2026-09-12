# Venue claims + report triage

## Purpose

Verify a `venue_claims` row (unlocks `/venue/:id/inbox`) and dismiss `pulse_reports` without inventing an admin UI login. Prefer `/ops` when the signed-in user already has `app_metadata.role = admin`.

Self-serve path: claimant enters a **work email**. After they confirm the
magic-link / OTP for that address, `try_verify_venue_claim_by_email_domain`
verifies the claim **only** when the email domain matches the venue
`website` host or `venues.owner_email_domain`. Pending stays pending on
mismatch. Never auto-verify from pending alone. Never invent admin.

## Preconditions

- Supabase project `xeldqwhztcnnvazmshzh`
- SQL editor access **or** a Pulse account with JWT `app_metadata.role = admin`
- Migrations:
  - `20260910140000_venue_claims_and_report_queue.sql` (already on prod from #82)
  - Optional: `20260911000000_owner_report_triage.sql` (owner dismiss via RLS)
  - Optional: `20260912000000_venue_claim_verified_badge.sql` (public Claimed chip; pending still hidden)
  - Additive: `20260912120000_venue_follows_push_claim_rate.sql` (`owner_email_domain`, `work_email`, domain-match RPC)

## Procedure — UI (`/ops`)

1. Sign in as an admin user.
2. Open `/ops`.
3. **Pending claims:** Verify or Reject. Rows show venue **name** when the join is available. Verified claimants can open `/venue/:id/inbox`. Pending never unlocks inbox.
4. **Pending reports:** Dismiss or Resolve (`actioned`). Owners can also dismiss from the inbox after the optional RLS migration.

Stop if you are not admin — do not paste service-role keys into the browser.

## Procedure — self-serve domain match (no admin)

1. Claimant signs in and opens `/venue/:id/inbox` (guests → `/auth`).
2. They submit evidence plus a **work email**.
3. If the session email is not that work address, Pulse sends a magic-link / OTP for it.
4. After they confirm, the client calls `try_verify_venue_claim_by_email_domain(claim_id)`.
5. SQL verifies only when:
   - `auth.uid()` owns the claim
   - session email equals stored `work_email`
   - `normalize_owner_domain(email)` is in `website` host or `owner_email_domain`
6. Otherwise the row stays `pending`. Inbox stays locked.

Optional: set `venues.owner_email_domain` when the public website host is
wrong or missing (SQL editor). Do not invent venues.

```sql
-- After 20260912120000 — inspect stored domains
SELECT id, name, website, owner_email_domain,
       public.normalize_owner_domain(website) AS website_host
FROM venues
WHERE id = '<venue-uuid>';

-- Verify snippet: supabase/verify/venue_claim_domain.sql
```

## Procedure — SQL (no admin UI)

List pending claims:

```sql
SELECT id, venue_id, user_id, status, evidence, notes, created_at
FROM venue_claims
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 50;
```

Verify one claim (unlocks inbox for that user + venue):

```sql
UPDATE venue_claims
SET status = 'verified',
    reviewed_at = timezone('utc', now()),
    notes = coalesce(notes, 'Verified via SQL editor')
WHERE id = '<claim-uuid>';
```

Reject:

```sql
UPDATE venue_claims
SET status = 'rejected',
    reviewed_at = timezone('utc', now()),
    notes = 'Rejected — could not confirm connection'
WHERE id = '<claim-uuid>';
```

Triage reports:

```sql
SELECT id, pulse_id, reporter_id, reason, status, created_at
FROM pulse_reports
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 50;

UPDATE pulse_reports
SET status = 'dismissed',
    reviewed_at = timezone('utc', now())
WHERE id = '<report-uuid>';
```

Grant `/ops` to a trusted user (Auth → user → raw `app_metadata`):

```json
{ "role": "admin" }
```

## Verification

- [ ] Claimant with `pending` still sees “Claim needed” and **0** tonight reviews
- [ ] Work email whose domain does **not** match stays `pending`
- [ ] Matching work email + confirmed OTP can reach `verified` without `/ops`
- [ ] After `verified`, `/venue/:id/inbox` lists tonight’s live reviews
- [ ] Guest hitting `/venue/:id/inbox` redirects to `/auth`
- [ ] Owner Reply persists locally; Dismiss updates local queue (and server if RLS applied)

## Rollback / Escalation

- Set `status = 'pending'` or `'rejected'` to lock the inbox again
- Do **not** drop leftover `signal_*` tables
- Escalate if RLS denies the update (`is_admin()` missing on the SQL role)

## Ownership

- Owner: Pulse ops / trust
- Last reviewed: 2026-09-12
