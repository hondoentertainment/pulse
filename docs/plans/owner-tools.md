# Next owner tools

Review for Kyle. Docs only. Builds on venue claims, `venues.claim_verified`, the public `venue_claim_badges` view, the owner inbox, and one-tap replies. Pending still does not unlock the inbox. No Stripe, no payouts, no messages Pulse sends on its own.

The rule for every feature below: never return or render `venue_claims` evidence, notes, user ids, or work emails. Not on `/ops`, not in an API response, not on a guest surface. The claimant can still submit those fields. The SQL editor runbook stays operator-only and is not copied into the app.

## Claim flow gaps

A signed-in user opens `/venue/:id/inbox`, writes how they are connected, and can add a work email. After they confirm that address, `try_verify_venue_claim_by_email_domain` verifies the claim only when the email domain matches the venue website host or `venues.owner_email_domain`. A mismatch stays pending. Guests go to `/auth`.

Gaps: the first submit does not require a work email. Rooms with no website and no owner domain can never self-verify, so they wait on an admin. The client type still mentions phone and document checks; the server path is email domain or admin only. `/ops` currently prints `claim.evidence`, and `GET /api/admin/venue-claims` selects `user_id`, evidence, and notes.

**RLS.** Keep `venue_claims` select as owner-or-admin. Do not add an anon policy. The admin list used by the app selects claim id, venue id, status, and `created_at`, and joins venue name and neighborhood. It does not select evidence, notes, user id, or work email.

## Verified badge

`venues.claim_verified` flips true when a claim is verified, and false when none are. Guests read that flag through `venue_claim_badges` (`security_invoker`, migration `20261113170000`). The public chip already says **Claimed**, which keeps it distinct from a GPS-verified pulse. Pending and rejected claims paint nothing. Do not join `venue_claims` to draw the chip.

**RLS.** No new policy. The view keeps reading `venues.claim_verified` only.

## What owners can edit

Verified owners and `venue_staff` cannot edit the venue today. The inbox is reply and dismiss. Leave name, address, coordinates, website, and `owner_email_domain` to operators. The website is the domain-match key, so an owner must not be able to change it and self-verify.

A verified owner may set Friday and Saturday hours (the existing `venues.hours` text) and a one-line tonight note guests can read on the venue page. No photos, no announcements, no promoted placement.

**RLS.** Update those two fields only when `auth.uid()` has a verified claim or a staff row for that venue. The policy cannot touch `claim_verified`, `owner_email_domain`, or any claim column.

## Owner reply and moderation

Verified owners can send the one-tap line “Thanks — see you tonight” or up to 280 characters. The reply shows on Live now as the venue, not as a person. Dismiss still `PATCH`es `/api/pulses/report`. An owner cannot hide a pulse for everyone; admin hide stays on `/ops`. `deleted_at` exists on `venue_owner_replies`, but there is no policy for the author to retract. The client select includes `user_id`, and anon can read that column. The venue report API also returns `reporter_id` to the owner. The inbox should show the report reason, not who filed it.

**RLS.** Insert stays verified-claim or staff, and `user_id = auth.uid()`. Public read is body and time only. Add an update so the author can set `deleted_at` on their own row. Do not grant a public update of the body.

## Simple stats

The inbox already shows tonight’s review count, average energy, and report count, and only after the inbox is unlocked. The Sunday note (`owner-weekly`) is pulse count plus here-now, in the app, with push only when VAPID already exists. That is the stats surface. Do not ship `VenueOwnerDashboard`: it counts distinct `userId`s and includes announcements and competitor blocks. Counts only. No visitor list.

**RLS.** Counts come from pulses and here-now for that venue. The return value has numbers, never user ids. Pending claims still get zeros.

## Admin review queue

`/ops` stays `app_metadata.role = admin`. Each pending claim shows venue name, neighborhood, status, and submitted time, with Verify and Reject. Each pending report shows the reason and asks for a resolution note, as it does now. Strip evidence, notes, user ids, and work emails from the JSON and the page. Reject still stores a note in SQL for the operator; the claimant sees a rejected state, not the evidence they submitted and not another person’s email.

**RLS.** `is_admin()` only, same as today. No second admin role.

## Phased PRs

**PR 1 — Redact the queue.** Stop selecting and rendering evidence, notes, user ids, and work emails on admin claims, and stop returning `reporter_id` on the owner report list. Files: `api/admin/venue-claims.ts`, `api/pulses/report.ts`, `src/lib/ops-client.ts`, `src/components/OpsQueuePage.tsx`, `src/lib/data/owner-replies.ts`, their tests. Migration: no. Smoke: `/ops` as admin shows venue name and Verify/Reject, and the response body has none of the four forbidden fields. A non-admin still sees the “admin role required” state. Pending inbox stays locked.

**PR 2 — Honest claim states.** Require a work email when the venue has a website or owner domain. If it has neither, say the claim stays pending for review. Drop phone and document as if they verify. Files: `src/components/VenueInboxPage.tsx`, `src/components/VenueInboxRoute.tsx`, `src/lib/claim-email-domain.ts`, `api/venues/claims.ts`, inbox tests. Migration: no. Smoke: matching domain can reach verified; a mismatch stays pending; a guest hits `/auth`.

**PR 3 — Hours and tonight note.** Verified owner edits Friday/Saturday hours and a one-line note. Files: a small editor on the inbox, `src/lib/data/venues.ts`, venue page read of the note, a migration for the update policy (and a `tonight_note` column if hours JSON is the wrong place). Migration: yes. Test: pending user gets no update; verified user cannot change website or `claim_verified`. Smoke: the note shows on the venue page; the claim chip stays Claimed.

**PR 4 — Retract a reply, keep the counts.** Author can soft-delete their reply. Public select drops `user_id`. Inbox keeps the three tonight numbers and does not add the prototype dashboard. Files: `supabase` policy migration, `src/lib/data/owner-replies.ts`, `src/components/VenueInboxPage.tsx`, `src/lib/owner-weekly.ts`, reply tests. Migration: yes. Smoke: Live now drops the retracted line; Sunday note shows counts only; anon reply read has no user id.

## Open questions for Kyle

1. Keep the public word **Claimed**, or switch the chip to **Verified** when `claim_verified` is true?
2. Are Friday/Saturday hours and a one-line tonight note the right edit set, with website and address staying operator-only?
3. Is venue name plus Verify/Reject enough on `/ops`, with evidence staying in the SQL editor only?
4. Should the Sunday stats note stay in-app unless VAPID is already set?
5. One verified claimant per venue, or several staff on the same inbox?
