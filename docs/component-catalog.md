# Component Catalog

Reference for React components in `src/components/`. Use this when locating UI for a feature, wiring new routes, or deciding where to add code.

**Counts:** ~138 top-level components, 10 feature subdirectories, 46 Shadcn primitives in `ui/`.

---

## Entry points

Pulse has two product shells. Only one is mounted from `src/App.tsx` at a time.

### Current entry (`App.tsx`)

```
LoginScreen (unauthenticated)
    └── SignalApp (authenticated)
            Routes: /home, /trends, /history, /settings
```

| Component | Path | Role |
|-----------|------|------|
| `LoginScreen` | `LoginScreen.tsx` | Root auth UI |
| `SignalApp` | `signal/SignalApp.tsx` | Self-contained router + bottom nav |
| `SignalOnboarding` | `signal/SignalOnboarding.tsx` | Signal first-run onboarding |
| `SignalCheckIn` | `signal/SignalCheckIn.tsx` | Daily check-in flow |
| `SignalChart` | `signal/SignalChart.tsx` | Trend visualization |
| `FirstWinDialog` | `signal/FirstWinDialog.tsx` | First-check-in celebration |

### Venue discovery shell (`AppRoutes.tsx`)

The full nightlife discovery experience. **Not mounted from `App.tsx` today** — swap the entry in `App.tsx` to use `AppRoutes` when switching products.

```
AppRoutes (React Router)
├── OnboardingFlow (first launch)
├── AuthGate (Supabase sign-in)
├── Main tabs via MainTabRouter
│     trending | discover | map | notifications | profile
├── SubPageRouter (secondary pages)
├── VenueRoute (/venue/:venueId)
└── Overlays: CreatePulseDialog, StoryViewer, SocialPulseDashboard
```

| Component | Path | Role |
|-----------|------|------|
| `AppRoutes` | `src/AppRoutes.tsx` | URL-based venue shell (outside `components/`) |
| `AppShell` | `AppShell.tsx` | State-driven shell (tabs + venue detail) |
| `MainTabRouter` | `MainTabRouter.tsx` | Switches main tab content |
| `SubPageRouter` | `SubPageRouter.tsx` | Secondary pages via `subPage` state |
| `VenueRoute` | `VenueRoute.tsx` | Deep-linked venue pages |
| `BottomNav` | `BottomNav.tsx` | 5-tab primary navigation |
| `AppHeader` | `AppHeader.tsx` | Location/market header |
| `OnboardingFlow` | `OnboardingFlow.tsx` | First-run preferences |
| `AuthGate` | `AuthGate.tsx` | Supabase auth gate |
| `ProtectedRoute` | `ProtectedRoute.tsx` | Generic React Router auth guard |
| `PageSkeleton` | `PageSkeleton.tsx` | Loading gate |

### Navigation map

**Main tabs** (`MainTabRouter`):

| Tab ID | Component | Purpose |
|--------|-----------|---------|
| `trending` | `TrendingTab` | Trending venues by energy |
| `discover` | `DiscoverTab` | Personalized discovery feed |
| `map` | `InteractiveMap` | Map with clustering and heatmap |
| `notifications` | `NotificationFeed` | Friend activity and surge alerts |
| `profile` | `ProfileTab` | User profile and settings entry |

**Sub-pages** (`SubPageRouter` keys):

| Key | Component |
|-----|-----------|
| `achievements` | `AchievementsPage` |
| `events` | `EventsPage` |
| `crews` | `CrewPage` |
| `insights` | `InsightsPage` |
| `neighborhoods` | `NeighborhoodView` |
| `playlists` | `PlaylistsPage` |
| `settings` | `SettingsPage` |
| `moderation` | `ModerationQueuePage` |
| `owner-dashboard` | `OwnerDashboardPage` |
| `night-planner` | `NightPlannerPage` |
| `integrations` | `IntegrationHub` |

**URL routes** (`AppRoutes.tsx`):

| Path | Component |
|------|-----------|
| `/` | Redirect to active tab |
| `/discover`, `/map`, `/trending`, `/notifications`, `/profile` | Tab views |
| `/venue/:venueId` | `VenueRoute` → `VenuePage` |
| `/admin/venues/:id/metadata` | `VenueMetadataRoute` |
| Sub-page paths | `SubPageRouter` |

---

## Feature packages (subdirectories)

### `ai-concierge/` — AI night planning

Gated by `VITE_AI_CONCIERGE_ENABLED`. See [AI Concierge](ai-concierge.md).

| Component | Purpose |
|-----------|---------|
| `ConciergeButton` | FAB to open chat |
| `ConciergeChatSheet` | Streaming chat UI |
| `PlanPreviewCard` | Rendered plan artifact |
| `SessionHistoryPage` | Past concierge sessions |

### `creator/` — Creator economy

Gated by `VITE_CREATOR_ECONOMY_ENABLED`. See [Creator Economy](creator-economy.md).

| Component | Purpose |
|-----------|---------|
| `CreatorEconomyTab` | Creator tab in profile |
| `ApplyForCreatorSheet` | Creator application flow |
| `CreatorEarningsSummary` | Earnings overview |
| `PayoutHistoryList` | Payout history |
| `ReferralCodeManager` | Create/manage referral codes |
| `CheckoutReferralInput` | Apply code at checkout |
| `VerifiedBadge` | Verified creator badge |

### `safety/` — Safety Kit

Gated by `VITE_SAFETY_KIT_ENABLED`. See [Safety Kit](safety-kit.md).

| Component | Purpose |
|-----------|---------|
| `SafetyHomeCard` | Entry card on profile/home |
| `StartSafeWalkSheet` | Start safe-walk session |
| `ShareNightSheet` | Share night with contacts |
| `PanicButton` | Emergency trigger |
| `ActiveSessionBanner` | Active session indicator |
| `EmergencyContactsPage` | Manage trusted contacts |
| `TrustedRideCta` | Uber/Lyft from safety context |

### `ticketing/` — Events & door scan

Gated by `VITE_TICKETING_ENABLED`. See [Payments](payments.md).

| Component | Purpose |
|-----------|---------|
| `PaymentElementMount` | Stripe Elements mount point |
| `StaffScannerPage` | Venue door QR scanner |
| `PayoutOnboarding` | Stripe Connect for venues |

### `video/` — Video pulses

Gated by `VITE_VIDEO_FEED_ENABLED`. See [Video Feed](video-feed.md).

| Component | Purpose |
|-----------|---------|
| `VideoFeed` | Vertical video feed |
| `VideoCaptureSheet` | Record/upload video pulse |

### `venue-admin/` — Venue metadata

| Component | Purpose |
|-----------|---------|
| `VenueMetadataRoute` | Admin route guard |
| `VenueMetadataForm` | Structured venue metadata editor |
| `PayoutOnboarding` | Venue Stripe Connect onboarding |

### `filters/` — Discovery filters

| Component | Purpose |
|-----------|---------|
| `AccessibilityFilter` | Map filter for accessibility features |

### `ui/` — Design system (Shadcn/Radix)

46 primitives. Do not edit directly unless syncing from Shadcn CLI.

`accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`

---

## Domain catalog (top-level components)

### Venue

| Component | Purpose |
|-----------|---------|
| `VenuePage` | Full venue detail page |
| `VenueCard` | Venue list card |
| `PromotedVenueCard` | Sponsored/promoted card |
| `ShareableVenueCard` | Share-optimized card |
| `VenueDetailHero` | Hero section |
| `ParallaxVenueHero` | Parallax hero variant |
| `VenueHeroCarousel` | Image carousel |
| `VenueReel` | Media reel |
| `VenueTimelapseGallery` | Timelapse gallery |
| `VenueLivePanel` | Live energy panel |
| `VenueEnergyTimeline` | Score over time |
| `VenueActivityStream` | Recent pulses at venue |
| `VenueNarrativeCard` | Narrative description |
| `VenueMemoryCard` | User memory at venue |
| `VenueActionPanel` | Primary venue actions |
| `VenueQuickActions` | Quick action chips |
| `VenueCompareSheet` | Side-by-side compare |
| `WhoIsHereRow` | Privacy-safe presence row |
| `TableBookingSheet` | Table reservation |
| `VenueOwnerDashboard` | Owner analytics widget |
| `VenuePlatformDashboard` | Platform-level dashboard |
| `OwnerDashboardPage` | Full owner dashboard page |
| `ScoreBreakdown` | "Why this score?" panel |

### Map & location

| Component | Purpose |
|-----------|---------|
| `InteractiveMap` | Main map with clustering |
| `MapboxBaseLayer` | Mapbox tile layer |
| `MapFilters` | Energy/category filters |
| `MapSearch` | Map-integrated search |
| `MapVenueSheet` | Venue preview sheet |
| `CityHeatmap` | City-level heatmap |
| `NeighborhoodView` | Neighborhood scores |
| `GPSIndicator` | GPS accuracy indicator |
| `FriendMapDots` | Friend locations on map |

### Discovery & feeds

| Component | Purpose |
|-----------|---------|
| `TrendingTab` | Trending tab page |
| `TrendingSections` | Trending Now / Just Popped / Gaining |
| `DiscoverTab` | Discover tab page |
| `ForYouFeed` | Personalized feed |
| `HomeSocialFeed` | Home social feed |
| `MySpotsFeed` | Followed venues feed |
| `ChallengeFeed` | Venue challenges |
| `RightNowSection` | Right-now recommendations |
| `HappeningNowBanner` | Live happening banner |
| `DailyDiscoveryDrop` | Daily discovery card |
| `RecommendationCard` | Single recommendation |
| `RecommendationsSection` | Recommendation list |
| `PredictiveSuggestion` | Predictive venue suggestion |
| `PredictiveSurgePanel` | Upcoming surge panel |
| `ContextualSearchSuggestions` | Context-aware search |
| `GlobalSearch` | App-wide search |
| `Favorites` | Favorited venues |
| `MoodSelector` | Mood-based filtering |
| `EnergySlider` | Energy rating slider |
| `VibeMatchMeter` | Vibe match score |
| `WeatherAwareTag` | Weather context tag |
| `TimeContextualLabel` | Time-of-day label |
| `AudioVibePreview` | Audio vibe preview |

### Social & pulses

| Component | Purpose |
|-----------|---------|
| `PulseCard` | Pulse in feed |
| `CreatePulseDialog` | Create pulse modal |
| `PulseMediaCarousel` | Pulse photo/video carousel |
| `PulseScore` | Energy score display |
| `StoryRing` | Story avatar ring |
| `StoryViewer` | Full-screen stories |
| `FriendActivityTimeline` | Friend activity |
| `FriendSuggestions` | Suggested friends |
| `MeetUpSuggestion` | Meet-up suggestion |
| `CrewPage` | Crews page |
| `CrewPanel` | Crew coordination panel |
| `GroupPollSheet` | Group poll |
| `PresenceSheet` | Presence settings |
| `LiveActivityFeed` | Live activity stream |
| `LiveActivityToast` | Live activity toast |
| `LiveCrowdIndicator` | Crowd level indicator |
| `FloatingReactions` | Animated reactions |
| `SocialProofBadge` | Social proof badge |
| `ShareSheet` | Share sheet |
| `QuickReportSheet` | Quick content report |
| `ReportDialog` | Full report dialog |
| `StreakBadge` | Post streak badge |
| `StreakCalendar` | Streak calendar |

### Events, planning & ticketing

| Component | Purpose |
|-----------|---------|
| `EventsPage` | Events listing |
| `EventCard` | Single event card |
| `NightPlannerPage` | Night planning |
| `NightRecapCard` | End-of-night recap |
| `LivePlanTracker` | Active plan tracker |
| `TicketPurchaseSheet` | Ticket purchase flow |
| `MyTicketsPage` | User's tickets |

### Profile, settings & gamification

| Component | Purpose |
|-----------|---------|
| `ProfileTab` | Profile tab |
| `Settings` | Inline settings panel |
| `SettingsPage` | Full settings page |
| `AchievementsPage` | Achievements |
| `AchievementBadge` | Single achievement |
| `MilestoneAnimation` | Milestone celebration |
| `PlaylistsPage` | Venue playlists |
| `InsightsPage` | Personal insights |

### Admin, owner & moderation

| Component | Purpose |
|-----------|---------|
| `ModerationQueuePage` | Content moderation queue |
| `SocialPulseDashboard` | X/social correlation dashboard |
| `SocialPulseGraph` | Social pulse chart |
| `AnalyticsDashboard` | Platform analytics |
| `GuestCRM` | Guest relationship management |
| `StaffScheduler` | Staff scheduling |
| `HashtagManager` | Hashtag management |
| `IntegrationHub` | Third-party integrations |
| `CompetitorBenchmark` | Competitor comparison |
| `CorrelationInsights` | Correlation insights |
| `CorrelationOverlayChart` | Overlay chart |
| `CreatorDashboard` | Creator admin dashboard |
| `CreatorProfileBadge` | Creator badge on profiles |

### Shell, layout & UX infrastructure

| Component | Purpose |
|-----------|---------|
| `AdaptiveHomeHeader` | Context-aware header |
| `ScrollAwareHeader` | Scroll-reactive header |
| `EnhancedBottomNav` | Animated nav variant (unused) |
| `PageTransition` | Page transition wrapper |
| `DirectionalPageTransition` | Directional transitions |
| `ToastSystem` | Toast notifications |
| `OfflineBanner` | Offline status |
| `PullToRefresh` | Pull-to-refresh wrapper |
| `EmptyState` | Generic empty state |
| `AnimatedEmptyState` | Animated empty state |
| `SkeletonCard` | Loading skeleton |
| `SkeletonCascade` | Cascading skeletons |
| `VirtualizedList` | Virtualized list |
| `ProgressiveImage` | Progressive image loader |
| `MicroInteractions` | Micro-interaction helpers |
| `SwipeableCard` | Swipeable card |
| `ReducedMotionWrapper` | Reduced-motion respect |
| `AccessibilityProvider` | A11y context |
| `NotificationCard` | Notification item |
| `TipSheet` | Tip/donation sheet |

---

## Adding a new component

Follow [CONTRIBUTING.md](../CONTRIBUTING.md):

1. **Domain logic** → `src/lib/` (pure, testable)
2. **Hook** → `src/hooks/` (state bridge)
3. **Component** → `src/components/` or feature subdirectory
4. **Wire** → `AppRoutes.tsx`, `MainTabRouter.tsx`, or `SubPageRouter.tsx`
5. **Test** → `src/components/__tests__/`

For feature-flagged surfaces, gate with `isFeatureEnabled()` from `src/lib/feature-flags.ts`.

---

## Related docs

- [ARCHITECTURE.md](../ARCHITECTURE.md) — layer responsibilities and data flow
- [CONTRIBUTING.md](../CONTRIBUTING.md) — code style and PR process
- [Feature Flags](feature-flags.md) — enable/disable feature packages
