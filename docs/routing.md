# Routing & Navigation

How users move through Pulse. Two product shells exist with different routing models.

---

## Entry points

| Shell | Mounted from | Router |
|-------|--------------|--------|
| **Signal** (current) | `src/App.tsx` | Internal router in `signal/SignalApp.tsx` |
| **Venue discovery** | `src/AppRoutes.tsx` (swap entry) | React Router v7 |

To switch products, change what `App.tsx` renders after auth.

---

## Signal app routes

`signal/SignalApp.tsx`:

| Path | Screen |
|------|--------|
| `/home` | Daily check-in |
| `/trends` | Trend chart |
| `/history` | Check-in history |
| `/settings` | Signal settings |

Uses its own bottom nav — independent of `BottomNav.tsx`.

---

## Venue discovery routes

`src/AppRoutes.tsx` + `use-route-navigation.ts`:

### Main tabs

| Path | Tab ID | Component |
|------|--------|-----------|
| `/` | `trending` | `TrendingTab` |
| `/discover` | `discover` | `DiscoverTab` |
| `/map` | `map` | `InteractiveMap` |
| `/notifications` | `notifications` | `NotificationFeed` |
| `/profile` | `profile` | `ProfileTab` |
| `/video` | `video` | `VideoFeed` (flagged) |

### Sub-pages

| Path | SubPage key | Component |
|------|-------------|-----------|
| `/events` | `events` | `EventsPage` |
| `/crews` | `crews` | `CrewPage` |
| `/achievements` | `achievements` | `AchievementsPage` |
| `/insights` | `insights` | `InsightsPage` |
| `/neighborhoods` | `neighborhoods` | `NeighborhoodView` |
| `/playlists` | `playlists` | `PlaylistsPage` |
| `/settings` | `settings` | `SettingsPage` |
| `/integrations` | `integrations` | `IntegrationHub` |
| `/moderation` | `moderation` | `ModerationQueuePage` |
| `/challenges` | `challenges` | `ChallengeFeed` |
| `/my-tickets` | `my-tickets` | `MyTicketsPage` |
| `/night-planner` | `night-planner` | `NightPlannerPage` |

### Entity routes

| Path | Component |
|------|-----------|
| `/venue/:venueId` | `VenueRoute` → `VenuePage` |
| `/admin/venues/:id/metadata` | `VenueMetadataRoute` |

### Deep links (native)

Configured in Capacitor and universal links:

| Pattern | Destination |
|---------|-------------|
| `/venue/*` | Venue page |
| `/pulse/*` | Pulse detail |
| `/crew/*` | Crew page |
| `/event/*` | Event page |
| `pulse://` | App scheme fallback |

See [Native Setup](native/setup.md).

---

## State-driven vs URL-driven navigation

Two patterns coexist:

### URL-driven (`AppRoutes`)

- `useRouteNavigation()` syncs `BottomNav` with React Router
- `navigateToTab(tab)` → `navigate(TAB_TO_PATH[tab])`
- `navigateToSubPage(page)` → `navigate(SUBPAGE_TO_PATH[page])`
- Browser back/forward works

### State-driven (`AppShell`)

- `activeTab` and `subPage` in `useAppState` / `useUiState`
- `MainTabRouter` and `SubPageRouter` read state, not URL
- Used when React Router is not the shell

Prefer URL-driven navigation for production (shareable links, deep links).

---

## Auth gates

| Component | Behavior |
|-----------|----------|
| `LoginScreen` | Shown when no session (Signal entry) |
| `AuthGate` | Supabase OAuth / magic link (venue entry) |
| `ProtectedRoute` | React Router wrapper — redirects unauthenticated |
| `OnboardingFlow` | First-run wizard before main shell |

E2E tests bypass auth with `VITE_E2E_AUTH_BYPASS=true`.

---

## Lazy loading

Heavy surfaces in `AppRoutes.tsx` use `React.lazy()`:

- `OnboardingFlow`, `AuthGate`, `StoryViewer`
- `SocialPulseDashboard`, `CreatePulseDialog`
- `VenueMetadataRoute`

Wrapped in `<Suspense fallback={<PageSkeleton />}>`.

---

## Overlays (not routes)

These render above the tab shell without changing the URL:

| Overlay | Trigger |
|---------|---------|
| `CreatePulseDialog` | FAB or venue action |
| `StoryViewer` | Story ring tap |
| `SocialPulseDashboard` | Admin toggle |
| `VenuePage` (state mode) | Venue card tap in `AppShell` |
| `PresenceSheet` | Presence settings |
| Feature sheets | Safety, ticketing, concierge |

---

## SPA hosting

Vercel `vercel.json` rewrites all non-API paths to `index.html`. Direct URL access and refresh work for any route above.

---

## Adding a new route

1. Create page component in `src/components/`
2. Add path mapping in `use-route-navigation.ts` (`SUBPAGE_TO_PATH` or `TAB_TO_PATH`)
3. Register in `AppRoutes.tsx` `<Routes>` or `SubPageRouter`
4. Add nav entry in `ProfileTab`, `BottomNav`, or relevant parent
5. Update [Component Catalog](component-catalog.md)

## Related docs

- [Component Catalog](component-catalog.md)
- [Hooks Catalog](hooks-catalog.md) — `useRouteNavigation`, `useDeepLinks`
- [Deployment Guide](deployment.md) — SPA rewrites
