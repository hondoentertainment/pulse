# Pulse — Recommended Next Steps

> Updated 2026-08-16 after implementing the Signal-first queue.

## Decision

**Pulse Signal is the default product** (`VITE_APP_MODE=signal`). Venue discovery remains in-repo behind `VITE_APP_MODE=venue`. See [PRD_SIGNAL.md](PRD_SIGNAL.md).

## Implemented in this cycle

| Item | Status |
|------|--------|
| #56 Product decision | Done — Signal-first, documented |
| Signal persistence migrations | Done — `20260816000000_*` |
| #59 Pilot email capture | Done — Settings form + `/api/signal/pilot` |
| #57 Server-side reminders | Done — cron `/api/signal/reminders/dispatch` + honest UI |
| #58 Morning vs evening check-ins | Done — unique `(user, day, window)`, Trends comparison |

## Still required in production (ops, not code)

- [ ] Apply the new Supabase migrations to the production project
- [ ] Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_MODE=signal`
- [ ] Set `VITE_VAPID_PUBLIC_KEY` + server VAPID/FCM keys for closed-app push
- [ ] Set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` for reminder dispatch

## Parked (venue track)

#48–#53 stay parked unless the default product changes.

Open PRs #42 / #44 / #55 are superseded for Signal work by this implementation. Keep #44 only if you want its commercial roadmap doc; do not take its default-mode flip.
