# Pulse

**Nightlife venue energy, on a map — where the night is alive right now.**

Pulse is a venue + map PWA. Open the app, see surging rooms nearby, check in, and post a pulse (energy + optional photo/video). Scores decay. Friends and trending surfaces follow the live energy.

Production: https://pulse-chi-nine.vercel.app/

## Product decision (2026-09-09)

**Venue + map is the shipping default** (`VITE_APP_MODE` unset or `venue`). See [PRD.md](PRD.md).

Pulse Signal (twice-daily personal check-in) stays in-repo behind `VITE_APP_MODE=signal`. See [PRD_SIGNAL.md](PRD_SIGNAL.md). This supersedes the 2026-08-16 Signal-default decision (#56).

Optional venue geo-gate: `VITE_LAUNCHED_CITIES=Seattle,WA`. Staging notes: [docs/runbooks/venue-staging.md](docs/runbooks/venue-staging.md).

**What to do next:** [RECOMMENDED_NEXT_STEPS.md](RECOMMENDED_NEXT_STEPS.md).

## How it works

1. **Map** — home surface: search, Electric / Buzzing / Near me filters, heatmap, surging nearby
2. **Venue** — live score, why-this-score, pulses, check in
3. **Pulse** — energy rating, optional media and caption
4. **Trending** — Just Popped / Trending / Gaining from live score and surge helpers

## Working today

- Venue shell as the default entry (`App.tsx` → `VenueApp` / `AppRoutes`)
- Map, trending, social pulse feed, friends/notifications, profile
- Check-in / create pulse with Dead → Electric energy
- Auth + persistence via Supabase when `VITE_SUPABASE_*` is set; otherwise seeded fixtures
- CI: lint, unit tests, venue smoke (primary), Signal smoke (flag-gated)

## Still operations work (not product invention)

- Apply Seattle venue + Signal migrations in the production Supabase project if those tables are used
- Set `VITE_SUPABASE_*` (and rebuild) so production is not fixture-only
- Optional: run Signal with `VITE_APP_MODE=signal`

## Tech stack

| Layer | Technologies |
|-------|-------------|
| **Framework** | React 19, TypeScript, Vite 7 |
| **Styling** | Tailwind CSS 4, CSS variables, dark nightlife theme |
| **UI** | Shadcn/Radix, Lucide, Phosphor |
| **State** | Zustand (Signal store), TanStack Query |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) + Vercel serverless `/api/*` |
| **Testing** | Vitest, Playwright (venue + Signal smokes) |
| **PWA** | Vite PWA / `public/sw.js`, Web Push |

## Local development

**Prerequisites:** Node.js 20+, npm

```bash
npm install
npm run dev
```

Venue + map is the default shell. Signal:

```bash
VITE_APP_MODE=signal npm run dev
```

```bash
npm run test
npm run test:smoke:venue
npm run lint
npm run build
```

Copy `.env.example` to `.env`. No vars are required for a local venue loop (seeded fixtures). Persistence needs Supabase — [docs/environment-variables.md](docs/environment-variables.md).

## Project structure

```
src/
├── App.tsx                 # Mounts venue AppRoutes (default) or SignalApp
├── components/             # Venue shell: map, trending, venue, create pulse
├── components/signal/      # Flag-gated Signal UI
├── lib/app-mode.ts         # VITE_APP_MODE resolver (default: venue)
api/                        # Serverless handlers
supabase/migrations/        # Signal core + venue launch SQL
e2e/                        # Playwright smokes
docs/runbooks/              # Launch, Web Push, venue staging
```

## Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](PRD.md) | Venue + map product requirements |
| [RECOMMENDED_NEXT_STEPS.md](RECOMMENDED_NEXT_STEPS.md) | Current ops queue |
| [docs/getting-started.md](docs/getting-started.md) | Install and env |
| [docs/runbooks/venue-staging.md](docs/runbooks/venue-staging.md) | Venue preview / Signal flag |
| [docs/environment-variables.md](docs/environment-variables.md) | Env reference |
| [docs/README.md](docs/README.md) | Full docs index |
| [PRD_SIGNAL.md](PRD_SIGNAL.md) | Signal (optional, `VITE_APP_MODE=signal`) |

## License

Private repository. All rights reserved.
