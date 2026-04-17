# Backend migration

This doc tracks the ongoing migration from the Spark-KV + mock fixture
reads used during prototyping to Supabase-backed reads via the modules in
`src/lib/data/*`.

## The `USE_SUPABASE_BACKEND` flag

Source of truth: `src/lib/data/config.ts`.

```ts
import { USE_SUPABASE_BACKEND } from '@/lib/data'
```

Resolution order:

1. If `VITE_USE_SUPABASE_BACKEND` is set to a falsy value (`false`, `0`,
   `off`, `no`), the flag resolves to `false` regardless of credentials.
2. Otherwise, the flag resolves to `true` **iff** the Supabase
   credentials in the env look real.
   - `hasPlaceholderCredentials()` in `src/lib/supabase.ts` checks for
     the sentinel `placeholder-*` values the dev client falls back to
     when no env vars are set.
3. In local dev without Supabase env vars, the flag is `false` and the
   app reads from local mock fixtures. A one-time `console.info` note
   and an in-app amber banner make this obvious.

### Turning it on locally

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your project's
   values.
3. Restart `bun run dev`. The amber "Mock data mode" banner should
   disappear and read paths should hit Supabase.

To force the mock path even with credentials set:

```
VITE_USE_SUPABASE_BACKEND=false bun run dev
```

## Migrated components

| Component / hook                     | Read path                                  | Fallback behavior                                                                                            |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `useAppState` venue hydration        | `VenueData.listVenues()`                   | Caught errors `console.warn` and fall back to `fetchVenuesFromSupabase()`, then to local mock fixtures.      |
| `useAppState` pulse hydration        | `PulseData.listLivePulses()`               | On failure falls back to `fetchPulsesFromSupabase()`; existing KV cache keeps the UI stable.                 |
| `VenueRoute` / `VenuePage` on-mount  | `VenueData.getVenue()` + `PulseData.listRecentPulsesAtVenue()` | On failure the page keeps rendering from cached venues/pulses in `AppState`.              |
| `PulseCard` reactions (via handlers) | `ReactionData.toggleReaction()`            | Optimistic local flip first. On server failure the optimistic change is rolled back and a toast is surfaced. |
| VenuePage check-in                   | `CheckInData.createCheckIn()`              | Surfaces `AuthRequiredError` / `RlsDeniedError` as toasts and aborts; otherwise proceeds to `handleCreatePulse`. |

All calls are wrapped in `try/catch` for `AuthRequiredError` (from
`src/lib/auth/require-auth.ts`) and `RlsDeniedError` (from
`src/lib/auth/rls-helpers.ts`). The handlers surface the error message
via the existing `sonner` toast system and the read paths continue with
the cached/mock payload so the UI never hard-fails on a network blip.

## Still reading mock data

These surfaces haven't been migrated yet — they continue to read from
`useKV` / mock fixtures and will need a follow-up pass:

- Notifications feed (`useAppState.notifications`) — `NotificationData.listMyNotifications()` exists but isn't wired in.
- Crews / crew check-ins (`useAppState.crews`, `useAppState.crewCheckIns`).
- Stories (`useAppState.stories`).
- Events (still via `fetchEventsFromApi` — separate REST backend).
- Playlists, promotions, content reports, follows, hashtags.
- `ProfileTab` view of a user's own pulses (should use `PulseData.listPulsesByUser`).
- `DiscoverTab` search (should use `VenueData.searchVenues`).
- Trending / nearby venue surfaces (should prefer `VenueData.listTrending` / `listNearby`).
- Pulse creation write path (still routes through `uploadPulseToSupabase`;
  will move to `PulseData.createPulse` once RLS policies are verified
  end-to-end).

## Constraints while the flag is off

- **Do not** delete the mock-data wrappers — they are the DEV fallback.
- Read paths remain gated on `USE_SUPABASE_BACKEND` so devs without
  credentials keep the same experience they had before.
- Write paths short-circuit when the flag is off: reaction toggles, for
  instance, only update local state — the optimistic UI is the single
  source of truth until the backend is enabled.
