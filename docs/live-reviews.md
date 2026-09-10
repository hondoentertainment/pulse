# Live Reviews v1

A **LiveReview** is an on-site pulse: venue + energy (Dead / Chill / Buzzing / Electric) + required caption (1–280 chars) + optional media + timestamp. No star ratings, no Yelp/Google import, no paid boost.

## Data model

Reviews reuse `pulses` instead of a parallel table.

| Field | Meaning |
|-------|---------|
| `kind` | `review` for venue create; existing rows stay `pulse` |
| `caption` | Required for `kind=review` |
| `has_body` | Generated column / client derived from caption |
| `location_verified` | True only when GPS placed the author inside `CHECK_IN_RADIUS_MILES` (~100m) |

**Migrations:** `supabase/migrations/20260909000000_live_reviews.sql` (reviews + `pulse_reports`), `supabase/migrations/20260910140000_venue_claims_and_report_queue.sql` (`venue_claims` + report status).

## Surfaces

- **Create** — `CreatePulseDialog` CTA “Post live review”. Caption required. Soft geo gate: GPS denied or outside radius still posts, marked unverified.
- **Venue detail** — Live now strip (last 90 min) above history. Tap opens the full review. New rows arrive on the existing `pulse-realtime` channel.
- **Map / Surging / Trending** — Live review counts from real pulses. Trending secondary-sorts by fresh review volume in the existing 15-minute window. No fabricated data.
- **Map realtime** — `useRealtimeSubscription` (`pulse-realtime`) already listens for `pulses` INSERT. `kind=review` flushes the pulse batch immediately, merges into the `['pulses']` query cache, and stamps `lastActivity` / `lastPulseAt` on the matching `['venues']` row. `InteractiveMap` and `SurgingNearbyList` read that cache (via `visiblePulses` / `visibleVenues`), so heatmap intensity, marker live counts, Surging cards, and a brief `Live · {venue} · {snippet}` toast update without a reload. Reviews for venues outside launch/geo `visibleVenues` are ignored. Quiet nearby = honest empty state, not invented cards.
- **Venue inbox** — `/venue/:venueId/inbox`, gated by `venueInbox` flag plus a **verified** server `venue_claims` row and/or `venue_staff`. Client `venue-claims` KV is only a mock/offline fallback. Pending claims do not unlock reviews. Honest “Claim needed” empty state + submit form.
- **Share** — `/venue/:id` is the stable deep link. Copy/share on the venue page; OG HTML at `/api/share/venue?venueId=`. After a live review, the success toast can copy that URL.

## Trust

- Auth required on Supabase writes (`requireUserId` / JWT).
- Per-venue cooldown: 120 minutes (client `canPostPulse` + API lookup).
- Global create bucket: 10/hour.
- Report: existing `ReportDialog` + persist to `pulse_reports` / `POST /api/pulses/report`. Reporter’s feed hides that pulse. Reporters can list their own rows (`GET /api/pulses/report`, Settings → My reports). Admins can list/update status (`?scope=all`, `PATCH`, `/moderation`).
- Location: GPS-denied posts stay allowed and **unverified**. The create API recomputes `location_verified` when lat/lng are sent and does not trust a client `true` without near-venue proof.

## Geo / launch gates

Reviews do not bypass `VITE_LAUNCHED_CITIES`. You can only review venues already in the visible, gated catalog.

## Analytics

Existing `pulse_created`, `pulse_viewed`, and `venue_viewed` events. Create now includes `kind` and `locationVerified`. Live now / inbox views use `feed: 'live_now' | 'inbox'`.

## Out of scope

Star ratings, external import, Stripe/paid boost, full owner CRM, heavy moderation console.
