# Hooks Catalog

Reference for custom React hooks in `src/hooks/`. Hooks bridge domain logic (`src/lib/`) and UI (`src/components/`).

**Rule:** Keep hooks focused — one concern per hook. Non-trivial logic belongs in `src/lib/`.

---

## State & orchestration

| Hook | File | Purpose |
|------|------|---------|
| `useAppState` | `use-app-state.tsx` | Main app state provider — venues, pulses, users, notifications, KV persistence |
| `useAppHandlers` | `use-app-handlers.ts` | Event handlers — pulse submit, reactions, check-ins, sharing |
| `useUiState` | `use-ui-state.tsx` | UI-only state — dialogs, sheets, selected venue, sub-page |
| `useVenueState` | `use-venue-state.tsx` | Venue-scoped state for detail pages |
| `useSocialState` | `use-social-state.tsx` | Social graph, friend activity, follows |

## Auth & data fetching

| Hook | File | Purpose |
|------|------|---------|
| `useSupabaseAuth` | `use-supabase-auth.tsx` | Sign-in, session, profile bootstrap, placeholder mode |
| `usePulses` | `api/use-pulses.ts` | TanStack Query — pulse feed from API/Supabase |
| `useVenues` | `api/use-venues.ts` | TanStack Query — venue catalog |
| `useSocial` | `api/use-social.ts` | TanStack Query — social feed data |
| `useUser` | `api/use-user.ts` | TanStack Query — current user profile |

## Location & map

| Hook | File | Purpose |
|------|------|---------|
| `useRealtimeLocation` | `use-realtime-location.ts` | GPS tracking with accuracy indicators |
| `useMapbox` | `use-mapbox.ts` | Mapbox GL map instance lifecycle |
| `useRouteNavigation` | `use-route-navigation.ts` | URL ↔ tab/sub-page navigation helpers |

## Realtime & offline

| Hook | File | Purpose |
|------|------|---------|
| `useRealtimeSubscription` | `use-realtime-subscription.ts` | Supabase Realtime channel subscriptions |
| `useOfflineMode` | `use-offline-mode.ts` | Offline detection and queue sync triggers |
| `useVenueSurgeTracker` | `use-venue-surge-tracker.ts` | Monitor venues for energy surges |

## Feature hooks

| Hook | File | Purpose |
|------|------|---------|
| `useSocialPulse` | `use-social-pulse.ts` | Social dashboard state and polling |
| `useSocialBuzz` | `use-social-buzz.ts` | Social buzz metrics |
| `useWeather` | `use-weather.ts` | Weather fetch for ranking boost (gated) |
| `useVideoFeed` | `use-video-feed.ts` | Vertical video feed pagination |
| `useSafetySession` | `use-safety-session.ts` | Safety Kit session lifecycle |
| `useVenueStaffStatus` | `use-venue-staff-status.ts` | Door staff / venue admin role check |
| `useFeatureFlag` | `use-feature-flag.ts` | Reactive feature flag access |
| `useSimulatedActivity` | `use-simulated-activity.ts` | Demo data generation (prototype) |

## Voice & input

| Hook | File | Purpose |
|------|------|---------|
| `useVoiceSearch` | `use-voice-search.ts` | Web Speech API venue search |
| `useVoiceFilter` | `use-voice-filter.ts` | Voice-activated map filters |

## Native & platform

| Hook | File | Purpose |
|------|------|---------|
| `useNativeAppBootstrap` | `use-native-app-bootstrap.ts` | Capacitor app init, deep links |
| `useNativeChrome` | `use-native-chrome.ts` | Status bar, splash screen, safe areas |
| `usePushRegistration` | `use-push-registration.ts` | APNs/FCM token registration |
| `useDeepLinks` | `use-deep-links.ts` | Universal link / app link handling |
| `useMobile` | `use-mobile.ts` | Mobile breakpoint detection |

## Preferences & UX

| Hook | File | Purpose |
|------|------|---------|
| `useUnitPreference` | `use-unit-preference.ts` | Imperial/metric toggle |
| `useNotificationSettings` | `use-notification-settings.ts` | Notification preferences |
| `useHaptics` | `use-haptics.ts` | Haptic feedback on energy selection |
| `useScrollAware` | `use-scroll-aware.ts` | Scroll position for header behavior |
| `useCurrentTime` | `use-current-time.ts` | Tick for time-sensitive UI |
| `useTrack` | `use-track.ts` | Analytics event helper |

---

## Context providers

`useAppState` and `useSupabaseAuth` export React contexts. Wrap the app tree in their providers (see `src/App.tsx`, `src/AppRoutes.tsx`).

```typescript
import { useAppState } from '@/hooks/use-app-state'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'

const { venues, pulses, currentUser } = useAppState()
const { session, signIn, signOut } = useSupabaseAuth()
```

## Adding a new hook

1. Create `src/hooks/use-my-hook.ts`
2. Import domain logic from `src/lib/` — no business logic in the hook body
3. Add tests in `src/hooks/__tests__/` if logic is non-trivial
4. Export from hook file; do not barrel-export unless needed

## Related docs

- [Component Catalog](component-catalog.md) — UI that consumes these hooks
- [Lib Modules](lib-modules.md) — pure logic behind hooks
- [Data Layer](data-layer.md) — Supabase vs mock data paths
- [CONTRIBUTING.md](../CONTRIBUTING.md) — hook conventions
