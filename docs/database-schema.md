# Database Schema

Reference for the Supabase PostgreSQL schema defined in `supabase/migrations/`. Apply migrations with [Backend Migration](backend-migration.md).

**Extensions:** PostGIS (`venues.geom`)

**Auth:** `profiles` extends `auth.users`. Most tables FK to `profiles(id)` or `auth.users(id)`.

---

## Migration inventory

| File | Domain |
|------|--------|
| `20260322000000_initial_schema.sql` | profiles, venues, pulses, notifications |
| `20260329000001_add_missing_tables_and_columns.sql` | presence, events, extra columns |
| `20260329000002_rls_policies.sql` | Initial RLS |
| `20260329000003_realtime.sql` | Realtime publication |
| `20260417000001_core_tables_and_soft_delete.sql` | reactions, check_ins, follows, soft-delete |
| `20260417000002_rls_policies_enforcement.sql` | Full RLS policy set |
| `20260417000003_ticketing_and_reservations.sql` | events, tickets, reservations, venue_staff |
| `20260417000004_safety_kit.sql` | emergency contacts, safety sessions |
| `20260417000005_ai_concierge.sql` | concierge sessions, messages, plans |
| `20260417000006_venue_structured_metadata.sql` | dress code, cover charge, accessibility |
| `20260417000007_ticket_scans.sql` | door scan fields, venue_staff roles |
| `20260417000008_push_tokens.sql` | device push tokens |
| `20260417000009_creator_economy.sql` | creators, referrals, payouts |
| `20260417000010_video_pulses.sql` | video metadata, reports, storage bucket |
| `20260428000000_venue_feedback_leadership.sql` | live reports, aggregates, pulse_reactions |
| `20260429000000_realtime_venue_intelligence.sql` | score functions, wait times, intelligence |
| `20260816000000_signal_core.sql` | Leftover unused Signal entries + profiles (not dropped) |
| `20260816000001_signal_pilot_signups.sql` | Leftover unused Pulse Pro waitlist emails (not dropped) |
| `20260816000002_signal_push_subscriptions.sql` | Leftover unused Web Push endpoints (not dropped) |
| `20260825000000_venue_signal_seattle_launch.sql` | Seattle neighborhoods, venue_signals, scouts, arrivals |
| `20260909000000_live_reviews.sql` | Live reviews + heatmap |
| `20260909120000_seattle_launch_venue_catalog.sql` | Idempotent 33-venue Seattle catalog upsert |
| `20260909180000_seattle_osm_venue_catalog.sql` | Idempotent 500-venue Seattle OSM nightlife catalog |
| `20260910140000_venue_claims_and_report_queue.sql` | `venue_claims` + `pulse_reports.status` |
| `20260911000000_owner_report_triage.sql` | Owner/staff RLS to read + dismiss venue reports |
| `20260912000000_venue_claim_verified_badge.sql` | `venues.claim_verified` + public `venue_claim_badges` |
| `20260912120000_venue_follows_push_claim_rate.sql` | `venue_follows`, `web_push_subscriptions`, domain-match claim RPC, pulse rate-limit trigger |

Verification queries: [supabase/verify/signal_launch.sql](../supabase/verify/signal_launch.sql) (leftover Signal tables), [supabase/verify/seattle_launch_venues.sql](../supabase/verify/seattle_launch_venues.sql) (533 Seattle venues), [supabase/verify/venue_claims.sql](../supabase/verify/venue_claims.sql), [supabase/verify/venue_follows.sql](../supabase/verify/venue_follows.sql), [supabase/verify/web_push_subscriptions.sql](../supabase/verify/web_push_subscriptions.sql), [supabase/verify/venue_claim_domain.sql](../supabase/verify/venue_claim_domain.sql), [supabase/verify/pulse_rate_limit.sql](../supabase/verify/pulse_rate_limit.sql).

---

## Leftover Pulse Signal tables (unused)

The Signal product was removed. These tables may still exist in shared databases. They are **not** used by the venue app. No drop migration was added.

Owner-only RLS. `ON DELETE CASCADE` from `auth.users`.

### `signal_entries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `auth.users` |
| `day_key` | TEXT | Local `YYYY-MM-DD` |
| `check_in_window` | TEXT | `morning` \| `evening` |
| `score` | INT | 0–100 |
| `energy`, `mood`, `stress`, `sleep_quality` | INT | 1–10 |
| `tags` | TEXT[] | Up to 3 in the UI |
| `focus` | TEXT | energy / mood / focus / sleep |

**Unique:** `(user_id, day_key, check_in_window)` — two check-ins per day max.

### `signal_profiles`

Reminder time/timezone/enabled plus tracking focus and goal. PK `user_id`.

### `signal_pilot_signups`

Idempotent Pulse Pro waitlist. Unique `(email, source)`.

### `signal_push_subscriptions`

Web Push endpoints (`endpoint`, `p256dh`, `auth`). Unique `endpoint`.

---

## Core

### `profiles`

User profile extending `auth.users`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, FK → `auth.users` |
| `username` | TEXT | UNIQUE, required |
| `display_name`, `bio` | TEXT | |
| `profile_photo_url` | TEXT | |
| `friends`, `favorite_venues`, `followed_venues` | UUID[]/TEXT[] | Legacy arrays |
| `credibility_score` | FLOAT | Default 1.0 |
| `presence_settings` | JSONB | |
| `venue_check_in_history` | JSONB | |
| `post_streak`, `last_post_date` | INT/DATE | |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | Soft-delete |

**RLS:** Public SELECT; owner INSERT/UPDATE.

### `venues`

Venue catalog with live intelligence fields.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | |
| `location_lat`, `location_lng` | FLOAT | |
| `geom` | GEOGRAPHY | Generated PostGIS point |
| `city`, `state`, `category` | TEXT | |
| `pulse_score`, `score_velocity` | FLOAT | Live energy (0–100) |
| `last_pulse_at`, `last_activity` | TIMESTAMPTZ | |
| `pre_trending`, `pre_trending_label` | BOOL/TEXT | Surge labels |
| `seeded` | BOOL | Seed vs real venue |
| `neighborhood` | TEXT | Launch neighborhood (Capitol Hill, Belltown, …) |
| `inventory_source` | TEXT | `curated-seed` (launch 33) or `osm` (comprehensive Seattle catalog) |
| `claim_verified` | BOOL | True only when a `venue_claims` row is `verified` (optional `20260912000000`) |
| `owner_email_domain` | TEXT | Optional host for self-serve claim verify (`20260912120000`) |
| `website` | TEXT | Public site; host used for domain-match claims |
| `dress_code` | ENUM | casual, smart_casual, upscale, formal, etc. |
| `cover_charge_cents` | INT | |
| `accessibility_features` | TEXT[] | GIN-indexed |
| `indoor_outdoor` | ENUM | indoor, outdoor, both |
| `hours`, `integrations` | JSONB | |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | |

**Indexes:** GIST on `geom`, score indexes, category/city, accessibility GIN.

**Realtime:** Yes. Score refreshed by `pulses_refresh_venue_intelligence` trigger.

### `venue_signals`

Versioned VenueSignal snapshot (`venue-signal.v1`). Client engine is source of truth; `refresh_venue_signal(venue_id)` writes a row for fan-out.

| Column | Notes |
|--------|-------|
| `venue_id` | PK, FK → venues |
| `model_configuration` | JSONB version + decay + 30s SLA |
| `energy_score`, `confidence`, `trend` | Unified live score |
| `freshness_minutes`, `source_mix`, `friction` | Worth-going inputs |
| `computed_at` | TIMESTAMPTZ |

### `scout_applications` / `scout_profiles`

Scout MVP. Reputation is corroboration quality, not report volume.

### `arrival_watches`

Post-Go arrival window + mismatch correction.

### `venue_wait_times`

ML wait-time snapshots.

| Column | Notes |
|--------|-------|
| `venue_id` | FK → venues |
| `estimated_minutes` | 0–240 |
| `confidence` | low, med, high |
| `sample_size`, `computed_at` | |

### `venue_live_reports` / `venue_live_aggregates`

Crowdsourced live intel with 30-minute rollup per venue.

Report types: `wait_time`, `cover_charge`, `music`, `crowd_level`, `dress_code`, `now_playing`, `age_range`.

**Realtime:** Both tables published.

---

## Social

### `pulses`

Geo-anchored posts at venues. Expire after 90 minutes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → profiles |
| `venue_id` | UUID | FK → venues |
| `crew_id` | UUID | No FK yet |
| `photos` | TEXT[] | Up to 3 |
| `video_url`, `video_*` | various | Video metadata (max 50 MB) |
| `energy_rating` | ENUM | dead, chill, buzzing, electric |
| `caption`, `hashtags` | TEXT/TEXT[] | Live reviews require caption (1–280) at the API/app layer |
| `kind` | TEXT | `pulse` (legacy energy-only) or `review` (live review). Default `pulse`. |
| `location_verified` | BOOLEAN | True when GPS was inside check-in radius. Default false. |
| `has_body` | BOOLEAN | Generated: caption present after trim |
| `views`, `credibility_weight` | INT/FLOAT | |
| `reactions` | JSONB | Legacy; synced from `pulse_reactions` |
| `created_at`, `expires_at` | TIMESTAMPTZ | Default expiry: +90 min |
| `deleted_at` | TIMESTAMPTZ | Soft-delete |

**Migration:** `supabase/migrations/20260909000000_live_reviews.sql`

### `pulse_reports`

Persisted hide/report rows for pulses (MVP). Reporter can insert/select their own rows. Admins via `is_admin()`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `reporter_id` | UUID | FK → profiles |
| `pulse_id` | UUID | FK → pulses |
| `reason` | TEXT | spam / inappropriate / harassment / misinformation / fake_location / other |
| `details` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | |
| UNIQUE | `(reporter_id, pulse_id)` | One report per user per pulse |

**Storage:** `pulse-videos` bucket (public read, owner-folder write).

**Realtime:** Yes.

### `reactions` / `pulse_reactions`

Two reaction models coexist:

| Table | Model |
|-------|-------|
| `reactions` | UUID PK, soft-delete, types: fire/eyes/skull/lightning |
| `pulse_reactions` | Composite PK, syncs to `pulses.reactions` JSONB |

Prefer `pulse_reactions` for new code. `toggle_pulse_reaction()` handles sync.

### `presence`

Current at-venue state (mutable).

| Column | Notes |
|--------|-------|
| `user_id`, `venue_id` | FKs |
| `lat`, `lng` | |
| `checked_in_at`, `left_at` | |
| `visibility` | everyone, friends, off |

**Realtime:** Yes.

### `check_ins`

Immutable geo-verified visit records.

| Column | Notes |
|--------|-------|
| `checked_in_lat/lng`, `distance_from_venue_mi` | |
| `source` | geo, manual, crew, event |
| `crew_id` | UUID |

**Realtime:** Yes.

### `follows`

User→user or user→venue follows.

| Column | Notes |
|--------|-------|
| `follower_id` | FK → profiles |
| `target_user_id` OR `target_venue_id` | Exactly one (CHECK) |
| `target_kind` | user, venue |

**Realtime:** Yes.

### `notifications`

| Column | Notes |
|--------|-------|
| `user_id` | FK → profiles |
| `type` | friend_pulse, pulse_reaction, friend_nearby, trending_venue, impact, wave |
| `pulse_id`, `venue_id` | Optional FKs |
| `read` | BOOL |

**Realtime:** Yes. Owner SELECT/UPDATE only.

### `push_tokens`

| Column | Notes |
|--------|-------|
| `user_id` | FK → profiles |
| `token` | UNIQUE per (user_id, token) |
| `platform` | ios, android |
| `device_id`, `app_version`, `last_seen_at` | |

**RLS:** Owner-only CRUD.

### `video_reports`

Moderation queue for video pulses.

Reasons: copyrighted_audio, nsfw, minor_in_frame, harassment, spam, misinformation, other.

---

## Events & Ticketing

### `events`

| Column | Notes |
|--------|-------|
| `venue_id` | FK → venues |
| `title`, `description` | |
| `starts_at`, `ends_at` | TIMESTAMPTZ |
| `cover_price_cents`, `capacity` | |
| `ticket_types` | JSONB |
| `status` | draft, published, sold_out, cancelled, completed |

### `venue_staff`

Maps users to venue roles. **Note:** migrations define conflicting role enums — reconcile before production.

| Migration | Roles |
|-----------|-------|
| `20260417000003` | owner, admin, staff |
| `20260417000007` | admin, door, manager |

### `venue_claims`

Server source of truth for venue inbox access (`20260910140000`). Unique `(venue_id, user_id)`.

| Column | Notes |
|--------|-------|
| `venue_id` | FK → venues |
| `user_id` | FK → profiles |
| `status` | `pending` \| `verified` \| `rejected` |
| `evidence`, `notes` | Claimant text; admin notes on reject |
| `work_email` | Optional work address for domain-match verify |
| `work_email_confirmed_at` | Set when domain-match RPC verifies |
| `reviewed_at` | Set when verified/rejected |

RLS: claimant reads own rows and inserts/updates **pending** only. `is_admin()` can do all. Inbox unlocks on `verified` or a `venue_staff` row. Guests read claimed venue ids only via `venue_claim_badges` (no evidence / user ids).

Self-serve verify: `try_verify_venue_claim_by_email_domain(claim_id)` — session email must equal `work_email` and the domain must match `website` host or `owner_email_domain`. Mismatch stays `pending`. Never verifies from pending alone.

### `venue_follows`

Persisted Follow (`20260912120000`). PK `(user_id, venue_id)`.

| Column | Notes |
|--------|-------|
| `user_id` | FK → profiles |
| `venue_id` | FK → venues |
| `created_at` | Follow time |

RLS: user reads/writes **own** rows only. Anon none. Guest Follow → `/auth`.

### `web_push_subscriptions`

PWA Web Push (`20260912120000`). Unique `(user_id, endpoint)`.

| Column | Notes |
|--------|-------|
| `user_id` | FK → profiles |
| `endpoint`, `p256dh`, `auth` | Push subscription |
| `lat`, `lng` | Optional nearby scope |
| `scope` | `followed` \| `nearby` \| `followed_or_nearby` |

RLS: user owns their rows. Fan-out uses the service role from `api/_lib/web-push-live.ts` or `supabase/functions/notify-live-pulse`. Missing `VAPID_*` is an honest no-op.

Pulse create rate limits (same migration): max **5** pulses per user per **10 minutes**, and **1** per user+venue per **2 minutes**. Enforced by `pulses_enforce_rate_limit` + `assert_pulse_rate_limit`. Clients cannot bypass.

### `pulse_reports` (queue columns)

Existing hide/report table plus `status` (`pending` \| `reviewed` \| `actioned` \| `dismissed`) and `reviewed_at`.

### `venue_payout_accounts`

Stripe Connect state (1:1 with venue).

### `tickets`

| Column | Notes |
|--------|-------|
| `event_id` | FK → events |
| `user_id` | FK → auth.users |
| `status` | pending, paid, refunded, transferred, cancelled |
| `stripe_payment_intent` | UNIQUE |
| `qr_code_secret` | HMAC-signed QR |
| `scanned_at`, `scanned_by_user_id` | Door scan |

### `reservations`

| Column | Notes |
|--------|-------|
| `venue_id`, `user_id` | FKs |
| `party_size`, `starts_at`, `ends_at` | |
| `status` | requested, confirmed, seated, cancelled, no_show, completed |
| `deposit_cents`, `deposit_payment_intent` | |

### `stripe_webhook_events`

Idempotency ledger for Stripe webhooks. Service role only.

---

## Safety Kit

### `emergency_contacts`

| Column | Notes |
|--------|-------|
| `user_id` | FK → profiles |
| `name`, `phone_e164` | E.164 format |
| `verified_at` | |
| `preferred_contact_method` | sms, push |

### `safety_sessions`

| Column | Notes |
|--------|-------|
| `kind` | safe_walk, share_night, panic |
| `state` | armed, active, completed, alerted, cancelled |
| `destination_venue_id` | FK → venues (optional) |
| `contacts_snapshot` | JSONB |
| `last_ping_at`, `expected_end_at` | |

### `safety_pings`

Location breadcrumbs per session. Purged after 30 days.

### `trusted_rides`

Uber/Lyft ride tracking linked to safety sessions.

### `contact_verification_codes`

OTP hashes for contact verification. Service role writes only.

### `safety_audit`

Alert/panic audit log.

---

## AI Concierge

### `concierge_sessions`

| Column | Notes |
|--------|-------|
| `id` | TEXT PK |
| `user_id` | FK → auth.users |
| `total_input_tokens`, `total_output_tokens`, `total_cost_cents` | |
| `model`, `metadata` | JSONB |

### `concierge_messages`

| Column | Notes |
|--------|-------|
| `session_id` | FK → concierge_sessions |
| `role` | user, assistant, tool |
| `content` | JSONB |
| `tool_name`, `tokens_in`, `tokens_out` | |

### `concierge_plans`

Saved plan artifacts with `plan_json` JSONB and `accepted` flag.

---

## Creator Economy

### `creator_profiles`

| Column | Notes |
|--------|-------|
| `user_id` | PK, FK → auth.users |
| `handle` | UNIQUE |
| `tier` | creator, verified, elite |
| `total_earnings_cents` | |
| `payout_account_id` | Shared Stripe infra |

### `referral_codes`

| Column | Notes |
|--------|-------|
| `code` | PK (6–8 char) |
| `creator_user_id` | FK → auth.users |
| `venue_id` | Optional scope |
| `discount_cents`, `max_uses`, `uses_count`, `is_active` | |

### `referral_attributions`

Links referral codes to ticket/reservation purchases. No client writes.

### `creator_payouts`

Periodic payout records with Stripe transfer IDs.

### `creator_verification_requests`

Creator application review queue.

---

## Entity relationships

```mermaid
erDiagram
    auth_users ||--o| profiles : extends
    auth_users ||--o{ tickets : owns
    auth_users ||--o{ reservations : books
    auth_users ||--o| creator_profiles : creator

    profiles ||--o{ pulses : posts
    profiles ||--o{ check_ins : visits
    profiles ||--o{ follows : follows
    profiles ||--o{ notifications : receives
    profiles ||--o{ emergency_contacts : safety

    venues ||--o{ pulses : hosts
    venues ||--o{ events : schedules
    venues ||--o{ presence : current
    venues ||--o{ reservations : tables
    venues ||--o| venue_live_aggregates : rollup

    events ||--o{ tickets : sold
    pulses ||--o{ pulse_reactions : reactions

    safety_sessions ||--o{ safety_pings : tracks
    concierge_sessions ||--o{ concierge_messages : contains
    referral_codes ||--o{ referral_attributions : attributes
```

---

## Realtime publication

Tables in `supabase_realtime` publication:

| Tables |
|--------|
| `pulses`, `presence`, `venues` |
| `reactions`, `check_ins`, `follows`, `notifications` |
| `venue_live_reports`, `venue_live_aggregates`, `pulse_reactions` |

Subscribe from the client via `use-realtime-subscription` or Supabase Realtime channels.

---

## RLS overview

Full policies live in `20260329000002_rls_policies.sql` and `20260417000002_rls_policies_enforcement.sql`.

| Pattern | Example |
|---------|---------|
| Public read | `venues`, `pulses` (non-deleted) |
| Owner write | `profiles`, `pulses`, `check_ins` |
| Owner read/write | `notifications`, `push_tokens`, `venue_follows`, `web_push_subscriptions`, `safety_sessions` |
| Staff read | `tickets` (via events join), `reservations` |
| Admin bypass | `is_admin()` function checks `SUPABASE_ADMIN_EMAILS` |
| Service role only | `stripe_webhook_events`, referral writes, cron jobs |

Server routes pass the caller's JWT to Supabase so RLS enforces identity. See `api/_lib/auth.ts`.

---

## Known schema caveats

1. **Dual reaction tables** — `reactions` and `pulse_reactions` both exist. Standardize on `pulse_reactions`.
2. **`venue_staff` role drift** — Two migrations define different role CHECK constraints.
3. **`crew_id`** — Referenced on `pulses` and `check_ins` without FK; crews table not yet migrated.
4. **`tickets.venue_id`** — Referenced in migration 7 index but may rely on join via `events.venue_id`.

---

## Related docs

- [Backend Migration](backend-migration.md) — apply migrations, seed, admin access
- [Data Layer](data-layer.md) — how the client reads/writes this schema
- [API Reference](api-reference.md) — server routes that mutate tables
- [PRODUCTION_DATA_PATH](PRODUCTION_DATA_PATH.md) — end-to-end production data flow
