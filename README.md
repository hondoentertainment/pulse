# Pulse Signal

**A ten-second check-in, twice a day, that turns how you felt into patterns you can act on.**

Pulse Signal is the shipping product in this repository. Open the app, log energy / mood / stress / sleep (and up to three tags), and get a 0–100 signal, a streak, and one next step. Morning and evening are separate windows. A day counts if either window is logged.

Production: https://pulse-chi-nine.vercel.app/

## How it works

1. **Check in** — morning (before noon) and/or evening (noon onward)
2. **See the signal** — score, insight, and one recommendation
3. **Keep the streak** — any logged window that day counts
4. **Read the week** — Trends compares AM/PM, weekly summary, and tag patterns

Same window cannot be saved twice. Signed-in history lives in Supabase (`signal_entries`) with a unique `(user_id, day_key, check_in_window)` constraint.

## Product decision

Pulse Signal is the default (`VITE_APP_MODE=signal` or unset). See [PRD_SIGNAL.md](PRD_SIGNAL.md).

The nightlife venue PWA stays in-repo behind `VITE_APP_MODE=venue` (optional geo-gate `VITE_LAUNCHED_CITIES=Seattle,WA`). Do **not** flip the production default. Staging steps: [docs/runbooks/venue-staging.md](docs/runbooks/venue-staging.md).

**What to do next:** [RECOMMENDED_NEXT_STEPS.md](RECOMMENDED_NEXT_STEPS.md).

## Working today

- Home AM/PM check-in, insight, streak with milestone celebrations (3/7/14/30/100), and 7-day average
- Trends chart, morning vs evening, weekly and monthly summaries, tag patterns, sleep → next-day link, personal records
- History log with window and tag filters, and CSV export
- Settings: daily reminder (honest permission copy), Pulse Pro pilot email, account data delete
- Server reminder cron (`/api/signal/reminders/dispatch`) plus Web Push subscribe
- Auth + persistence via Supabase when `VITE_SUPABASE_*` is set; otherwise local-only
- CI: lint, unit tests, Signal smoke (`smoke-preview-signal` + `smoke-preview` alias), venue smoke (advisory)

## Still operations work (not product invention)

- Apply Signal (+ Seattle venue launch) migrations in the production Supabase project
- Set `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and optional VAPID keys
- Prove two-device persist and closed-app Web Push on the live URL

Runbook: [docs/runbooks/signal-launch.md](docs/runbooks/signal-launch.md).

## Tech stack

| Layer | Technologies |
|-------|-------------|
| **Framework** | React 19, TypeScript, Vite 7 |
| **Styling** | Tailwind CSS 4, CSS variables, dark theme |
| **UI** | Shadcn/Radix, Lucide, Phosphor |
| **State** | Zustand (Signal store), TanStack Query |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) + Vercel serverless `/api/*` |
| **Testing** | Vitest, Playwright (Signal + venue smokes) |
| **PWA** | Vite PWA / `public/sw.js`, Web Push |

## Local development

**Prerequisites:** Node.js 20+, npm

```bash
npm install
npm run dev
```

Signal is the default shell. Venue staging:

```bash
VITE_APP_MODE=venue VITE_LAUNCHED_CITIES=Seattle,WA npm run dev
```

```bash
npm run test
npm run test:smoke:signal
npm run lint
npm run build
npm run verify:signal-prod
```

Copy `.env.example` to `.env`. No vars are required for a local Signal loop (localStorage). Persistence and reminders need Supabase + server env — [docs/environment-variables.md](docs/environment-variables.md).

## Project structure

```
src/
├── App.tsx                 # Mounts SignalApp or venue AppRoutes
├── components/signal/      # Shipping Signal UI
├── lib/signal-*.ts         # Windows, insights, export, patterns, reminders
├── stores/use-signal-store.ts
api/signal/                 # Pilot, push subscribe, reminders, account delete
supabase/migrations/        # Signal core + venue launch SQL
e2e/                        # Playwright smokes
docs/runbooks/              # Launch, Web Push, venue staging
```

## Documentation

| Document | Description |
|----------|-------------|
| [PRD_SIGNAL.md](PRD_SIGNAL.md) | Signal product requirements |
| [RECOMMENDED_NEXT_STEPS.md](RECOMMENDED_NEXT_STEPS.md) | Current ops queue |
| [docs/getting-started.md](docs/getting-started.md) | Install and env |
| [docs/runbooks/signal-launch.md](docs/runbooks/signal-launch.md) | Production schema + loop |
| [docs/runbooks/signal-web-push.md](docs/runbooks/signal-web-push.md) | Closed-app push proof |
| [docs/environment-variables.md](docs/environment-variables.md) | Env reference |
| [docs/README.md](docs/README.md) | Full docs index |
| [PRD.md](PRD.md) | Venue PWA (flag-gated) |

## License

Private repository. All rights reserved.
