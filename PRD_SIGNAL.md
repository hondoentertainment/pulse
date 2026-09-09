# Pulse Signal — Product Requirements

> Optional product for `VITE_APP_MODE=signal`. Production default is venue + map ([PRD.md](PRD.md)).

**One line:** A ten-second check-in, twice a day, that turns how you felt into patterns you can act on.

## Decision (updated 2026-09-09)

Venue + map is the shipping default. Pulse Signal stays in-repo behind `VITE_APP_MODE=signal`. The 2026-08-16 Signal-default decision (#56) is superseded.

## Core loop

1. Check in morning and/or evening (energy, mood, stress, sleep, up to 3 tags)
2. Get a 0–100 signal, an insight, and one recommendation
3. Keep a daily streak (a day counts if either window is logged); milestones at 3, 7, 14, 30, and 100 days are celebrated once
4. Compare morning vs evening once both exist
5. Read the patterns as data accumulates: tag lifts and drains, sleep against the following day, personal records, and a month against the one before

## Data

- `signal_entries` — owner-only RLS, unique `(user_id, day_key, check_in_window)`
- `signal_profiles` — focus, goal, reminder time/timezone/enabled
- `signal_pilot_signups` — idempotent `(email, source)`
- `signal_push_subscriptions` — Web Push endpoints for closed-app reminders

## Reminders

Local in-app nudge always. Closed-app Web Push requires `VITE_VAPID_PUBLIC_KEY` plus server `VAPID_*` / native push env. The cron at `/api/signal/reminders/dispatch` fans out to both native `push_tokens` and stored `signal_push_subscriptions`, and only when today is still unlogged.

## Out of scope

Social comparison, clinical scoring, diagnosis, medication tracking.
