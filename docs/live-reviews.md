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

**Migration:** `supabase/migrations/20260909000000_live_reviews.sql`

Also adds `pulse_reports` for persisted hide/report.

## Surfaces

- **Create** — `CreatePulseDialog` CTA “Post live review”. Caption required. Soft geo gate: GPS denied or outside radius still posts, marked unverified.
- **Venue detail** — Live now strip (last 90 min) above history. Tap opens the full review. New rows arrive on the existing `pulse-realtime` channel.
- **Map / Surging / Trending** — Live review counts from real pulses. Trending secondary-sorts by fresh review volume in the existing 15-minute window. No fabricated data.
- **Venue inbox** — `/venue/:venueId/inbox`, gated by `venueInbox` flag plus a verified claim (`venue-claims` KV) or `venue_staff` row. Honest claim-needed empty state if neither exists.

## Trust

- Auth required on Supabase writes (`requireUserId` / JWT).
- Per-venue cooldown: 120 minutes (client `canPostPulse` + API lookup).
- Global create bucket: 10/hour.
- Report: existing `ReportDialog` + persist to `pulse_reports` / `POST /api/pulses/report`. Reporter’s feed hides that pulse.

## Geo / launch gates

Reviews do not bypass `VITE_LAUNCHED_CITIES`. You can only review venues already in the visible, gated catalog.

## Analytics

Existing `pulse_created`, `pulse_viewed`, and `venue_viewed` events. Create now includes `kind` and `locationVerified`. Live now / inbox views use `feed: 'live_now' | 'inbox'`.

## Out of scope

Star ratings, external import, Stripe/paid boost, full owner CRM, heavy moderation console.
