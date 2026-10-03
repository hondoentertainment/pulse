# Pulse

**Nightlife venue energy, on a map — where the night is alive right now.**

Pulse is a venue + map PWA. Open the app, see surging rooms nearby, check in, and post a pulse (energy + optional photo/video). Scores decay. Friends and trending surfaces follow the live energy.

Production: https://pulse-chi-nine.vercel.app/

## Product

Pulse is **venue + map only**. The former Pulse Signal personal check-in product was removed — there is no `VITE_APP_MODE` switch and no Signal shell.

See [PRD.md](PRD.md). Optional venue geo-gate: `VITE_LAUNCHED_CITIES=Seattle,WA`. Staging notes: [docs/runbooks/venue-staging.md](docs/runbooks/venue-staging.md).

**What to do next:** [RECOMMENDED_NEXT_STEPS.md](RECOMMENDED_NEXT_STEPS.md).

## How it works

1. **Map** — home surface: search, Electric / Buzzing / Near me filters, heatmap, surging nearby
2. **Venue** — live score, why-this-score, pulses, check in
3. **Pulse** — energy rating, optional media and caption
4. **Trending** — Just Popped / Trending / Gaining from live score and surge helpers

## Working today

- Venue shell as the only entry (`App.tsx` → `VenueApp` / `AppRoutes`)
- Map, trending, social pulse feed, friends/notifications, profile
- Check-in / create pulse with Dead → Electric energy
- Auth + persistence via Supabase when `VITE_SUPABASE_*` is set; otherwise seeded fixtures
- CI: lint, unit tests, venue smoke

## Still operations work (not product invention)

- Apply Seattle venue migrations in the production Supabase project if those tables are used
- Set `VITE_SUPABASE_*` (and rebuild) so production is not fixture-only
- Leftover Signal SQL tables (`signal_entries`, `signal_profiles`, `signal_pilot_signups`, `signal_push_subscriptions`) may still exist in shared databases — they are unused by the app and were not dropped in this cut

## Tech stack

| Layer | Technologies |
|-------|-------------|
| **Framework** | React 19, TypeScript, Vite 7 |
| **Styling** | Tailwind CSS 4, CSS variables, dark nightlife theme |
| **UI** | Shadcn/Radix, Lucide, Phosphor |
| **State** | TanStack Query, app state hooks |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) + Vercel serverless `/api/*` |
| **Testing** | Vitest, Playwright (venue smoke) |
| **PWA** | Vite PWA / `public/sw.js` |

## Local development

**Prerequisites:** Node.js 20+, npm

```bash
npm install
npm run dev
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
├── App.tsx                 # Always mounts the venue shell
├── VenueApp.tsx            # AppProviders + AppRoutes
├── components/             # Map, trending, venue, create pulse
api/                        # Serverless handlers
supabase/migrations/        # Venue (+ leftover unused Signal) SQL
e2e/                        # Playwright venue smokes
docs/runbooks/              # Venue staging and ops
```

## Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](PRD.md) | Venue + map product requirements |
| [RECOMMENDED_NEXT_STEPS.md](RECOMMENDED_NEXT_STEPS.md) | Current ops queue |
| [docs/getting-started.md](docs/getting-started.md) | Install and env |
| [docs/runbooks/venue-staging.md](docs/runbooks/venue-staging.md) | Venue preview / production checks |
| [docs/environment-variables.md](docs/environment-variables.md) | Env reference |
| [docs/README.md](docs/README.md) | Full docs index |

## License

Private repository. All rights reserved.
