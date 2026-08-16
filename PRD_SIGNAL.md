# Pulse Signal — Product Requirements

> Shipping product for `VITE_APP_MODE=signal` (the production default).
> Venue discovery is specified in [PRD.md](PRD.md) and stays behind `VITE_APP_MODE=venue`.

**One line:** A ten-second check-in, twice a day, that turns how you felt into patterns you can act on.

## Decision (#56)

Pulse Signal is the default product. Venue discovery remains in the repo as a dormant, flag-gated shell. Do not flip the default without updating README, CI smoke jobs, and this file.

## Core loop

1. Check in morning and/or evening (energy, mood, stress, sleep, up to 3 tags)
2. Get a 0–100 signal, an insight, and one recommendation
3. Keep a daily streak (a day counts if either window is logged)
4. Compare morning vs evening once both exist

## Data

- `signal_entries` — owner-only RLS, unique `(user_id, day_key, check_in_window)`
- `signal_profiles` — focus, goal, reminder time/timezone/enabled
- `signal_pilot_signups` — idempotent `(email, source)`
- `signal_push_subscriptions` — Web Push endpoints for closed-app reminders

## Reminders

Local in-app nudge always. Closed-app Web Push requires `VITE_VAPID_PUBLIC_KEY` plus server `VAPID_*` / native push env. The cron at `/api/signal/reminders/dispatch` sends only when today is still unlogged.

## Out of scope

Social comparison, clinical scoring, diagnosis, medication tracking.
