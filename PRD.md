# Pulse — Real-Time Venue Energy Tracker

Pulse shows users where the energy is happening right now by letting them check into venues and share the vibe through quick posts with photos, videos, and energy ratings.

## Pulse Core Loop

The fundamental habit loop that drives engagement and retention:

1. **User opens app** → sees nearby venues surging right now
2. **User goes to venue** → checks in → posts a pulse with energy rating
3. **Pulse increases venue score** → triggers friend notifications + surge alerts
4. **Friends discover venue** → repeat cycle

This loop creates a self-reinforcing network effect where each pulse contributes to discovery, driving more users to venues, generating more pulses, and amplifying the signal of where the energy is happening right now.

**Experience Qualities**:
1. **Immediate** - Every interaction should feel instant, with real-time updates showing what's happening now, not five minutes ago
2. **Visceral** - Users should feel the energy of a place through bold visuals, pulsing animations, and high-energy design that mirrors the excitement they're tracking
3. **Authentic** - Location-verified posts and time-decay mechanics ensure what you see reflects current reality, not stale content

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
- This app requires real-time scoring, geolocation verification, media uploads, social features, multiple views (map, feed, venue pages), and a sophisticated algorithm for calculating venue energy scores

## Essential Features

### Onboarding & Splash Screen
- **Functionality**: First-launch experience with branded splash screen and location permission request
- **Purpose**: Welcome new users, explain app value proposition, and request necessary permissions upfront
- **Trigger**: User opens app for the first time (before main app loads)
- **Progression**: Welcome screen with app logo and tagline → User taps "Get Started" → Location permission screen with benefits explanation → User grants or skips permission → Main app loads
- **Success criteria**: Onboarding shown only once on first launch, permission state persists, users understand why location is needed, graceful handling of permission denial

### Location-Based Check-In
- **Functionality**: Detects nearby venues using real-time GPS tracking with continuous position updates and allows users to check in only when physically present
- **Purpose**: Ensures authenticity and prevents fake posts from people not actually at the venue, while providing live tracking of user movement on the map
- **Trigger**: User opens app, grants location permission, and taps a nearby venue
- **Progression**: App loads → Real-time GPS tracking begins → Location continuously updates on map → Nearby venues displayed → User selects venue → Geo-fence verified with current position → Check-in confirmed
- **Success criteria**: Users can only create pulses for venues within proximity to their current real-time location; attempts to post from wrong location are blocked; user position marker updates smoothly on map as they move; GPS accuracy indicator shows tracking status and precision level

### Create Pulse
- **Functionality**: Quick post creation with optional photos (up to 3), optional video (up to 30 seconds), required energy rating with haptic feedback, and optional caption
- **Purpose**: Captures the current vibe of a venue through multimedia and energy level with tactile feedback that enhances the selection experience
- **Trigger**: User checks into a venue
- **Progression**: Check-in verified → Energy slider (Dead/Chill/Buzzing/Electric) selected with haptic feedback on each level change → Optional media uploaded (photos or video, mutually exclusive) → **Client-side video compression (max 10MB/30s) processed automatically** → **Contextual hashtags selected from AI-powered suggestions** → Optional caption added → Pulse posted → Appears in feeds
- **Success criteria**: Pulses successfully save with all metadata, **video compression reduces file size while maintaining visibility**, duration validation enforces 30-second limit, display in venue feeds, contribute to energy score, and haptic feedback triggers appropriately on supported devices (light vibration for Dead/Chill, medium for Buzzing, heavy for Electric)

### Real-Time Pulse Score
- **Functionality**: Calculates live energy score based on recent pulse volume, energy ratings, engagement, and velocity with transparent explainability
- **Purpose**: Shows which venues are hot right now, not yesterday, with trust-building transparency
- **Trigger**: New pulse posted or engagement added
- **Progression**: Pulse created → Score algorithm runs → Weighted calculation (recency + energy rating + engagement) → Score updated → UI reflects new score → Old pulses decay after 90 minutes → User taps "Why this score?" → Expandable panel shows breakdown
- **Success criteria**: Scores update in real-time, reflect current activity accurately, auto-decay old pulses, and transparent breakdown builds trust without exposing gaming vulnerabilities

### Score Transparency Panel
- **Functionality**: Optional expandable panel on venue pages showing score calculation breakdown in simple, read-only format
- **Purpose**: Build trust in the energy score without creating gamification or exposing the full algorithm
- **Trigger**: User taps "Why this score?" link below the main energy score display
- **Progression**: Venue page loaded → User sees energy score → Taps info icon or "Why?" text → Panel expands → Shows: pulse count in last 90 mins, average energy level, recent score change (+/- points in last 10 min), time of last pulse → User taps to collapse
- **Success criteria**: Panel displays clear, non-technical explanations; doesn't show individual weights or formula details; updates in real-time as score changes; reinforces authenticity without enabling gaming

### Venue Discovery
- **Functionality**: Browse trending venues via interactive map view with energy heatmap, real-time GPS tracking with live position updates, voice-enabled search, and voice-activated filters or list view with "Just Popped" surges
- **Purpose**: Help users find where the energy is happening right now through visual heat mapping, continuous location tracking, hands-free voice search, and voice-controlled filtering by energy level and category
- **Trigger**: User opens Trending tab or Map view, activates voice search with microphone button, or activates voice filter in map filters panel
- **Progression**: View loaded → Venues sorted by score → Real-time GPS tracking begins → User position continuously updates on map with accuracy indicator → Interactive map with draggable canvas and zoom controls shows real-time color-coded energy heatmap → User hovers over venue pins for quick preview → User clicks venue OR taps microphone icon → Speaks venue name → Voice transcript populates search → Results filter instantly → User selects venue → Venue page opens OR User opens filters panel → Taps voice filter button → Speaks filter command (e.g., "show electric venues" or "filter bars and clubs") → Voice command parsed → Filters applied automatically → Map updates to show filtered results → Re-center button with tracking indicator allows following user movement
- **Success criteria**: **Trending list categorized into "Trending Now" (multi-user activity), "Just Popped Off" (rapid surge), and "Gaining Energy" (building momentum)**; Trending list updates in real-time, interactive map visualizes energy density with gradient heatmap overlays, users can pan/zoom/navigate to any venue, user position updates continuously with pulsing location marker and accuracy circle, GPS tracking indicator shows live tracking status with accuracy measurement, manual pan/zoom disables auto-follow mode, re-center button re-enables position tracking, tooltips show venue details on hover, voice recognition accurately transcribes venue names and filter commands, voice search works hands-free on supported browsers, voice filter understands natural language commands for energy levels (dead/chill/buzzing/electric) and categories, filters apply instantly after voice command completes, toast notifications confirm applied filters

### Social Layer
- **Functionality**: Follow friends and venues, see recent pulses from both, add emoji reactions
- **Purpose**: Adds social proof through friends and allows solo users to follow venues they care about for sustained engagement
- **Trigger**: User navigates to Friends feed, Followed Venues tab, or reacts to a pulse
- **Progression**: Social feed opens → Toggle between "Friends" and "My Spots" → Recent pulses displayed from followed users or venues → User taps emoji → Reaction saved → Count increments
- **Success criteria**: Friend and venue activity updates in real-time, reactions are instant, no comment threads, venue following creates sustained engagement even without active friend network

### Venue Following
- **Functionality**: Users can follow up to 10 favorite venues to create a personalized feed of activity at places they care about
- **Purpose**: Keeps users engaged even without an active friend network; allows discovery without social pressure
- **Trigger**: User stars a venue on venue page or from trending list
- **Progression**: Venue page opened → User taps star icon → Venue added to followed list → New tab "My Spots" appears in navigation → Feed shows chronological pulses from all followed venues → User can unfollow to remove
- **Success criteria**: Users can follow/unfollow venues easily, followed venue feed updates in real-time, limit of 10 venues prevents list bloat, provides engagement path for solo users

### Settings & Preferences
- **Functionality**: Configure app preferences including imperial/metric unit system toggle and notification preferences
- **Purpose**: Personalize the app experience to match user's location and preferences
- **Trigger**: User navigates to Profile tab in bottom navigation and scrolls to Settings section
- **Progression**: Profile tab opened → User scrolls to Settings section at bottom → Unit preference toggle displayed → User switches between Imperial (mi, ft) and Metric (km, m) → Preference saved → All distance displays update throughout app
- **Success criteria**: Unit preference persists across sessions, all distance displays (venue cards, map filters, venue details) update immediately to reflect chosen system, Settings section is accessible within Profile page

### Pulse Credibility & Trust Badges
- **Functionality**: Weighted credibility system that increases the influence of trusted users' pulses on venue scores. Users earn trust badges displayed on their pulse cards based on venue check-in history and engagement patterns. No public scores or ranks — just ambient trust signals.
- **Purpose**: Prevent gaming, reduce spam impact, and reinforce authentic contributions without killing the vibe or creating social hierarchy
- **Trigger**: New user creates account → starts with neutral credibility weight (0.5-0.7) → weight increases with genuine activity → badges appear automatically on pulse cards when thresholds met
- **Progression**: New user posts pulse with reduced weight → User checks in frequently → Credibility increases (up to 2.0x max) → "Regular here" badge appears after 10+ check-ins at venue → "Frequent visitor" after 5+ → "Veteran" badge for 90+ day accounts with 20+ pulses → "3rd pulse tonight" badge shows recent activity → Trusted users' pulses contribute more to venue scores → No user-facing credibility number displayed
- **Success criteria**: Credibility weight applies transparently to pulse score calculations, new users can't artificially inflate scores, regular users gain influence naturally, badges display on pulse cards only (not profiles), subtle visual design reinforces trust without creating status competition, tooltip shows badge meaning on hover, no gaming incentive created

### In-App Notifications
- **Functionality**: Real-time feed of friend activity including friend pulses, reactions to user's pulses, friends nearby at venues, trending venue surge alerts, and impact notifications when user's pulse moves venue score across energy thresholds. Multiple reactions on the same pulse are intelligently grouped together. Surge tracking monitors venues in real-time and generates notifications when nearby venues experience rapid score increases.
- **Purpose**: Keep users connected to their friends' activity, discover trending venues through social proof, and create ownership/pride when user contributions move the needle. Surge notifications help users catch venues at peak energy moments. Grouped notifications reduce clutter.
- **Trigger**: Friend posts a pulse, reacts to user's pulse, checks into nearby venue, venue surges in popularity (score reaches 60+ with 20+ point increase within alert window), or user's pulse causes venue to cross energy threshold (e.g., Chill → Buzzing, Buzzing → Electric)
- **Progression**: Notification created → Badge appears on Notifications tab → User taps Notifications → Feed displays recent activity with unread indicators → Multiple reactions to same pulse grouped with combined user avatars and reaction icons → Trending venue notifications show "Hot Right Now" badge with animated glow → Impact notification shows "Your pulse pushed [Venue] into Electric ⚡" → User taps notification → Navigates to relevant venue or pulse → All grouped notifications marked as read

### Social Pulse Correlation System (Admin Dashboard)
- **Functionality**: Real-time backend system...
- **Active Heatmap**: Real-time visualization of pulse density.
- **Who's Here (Proximity & History)**: (NEW) Privacy-first presence sharing.
  - **The Safety Buffer**: Counts only show if ≥2 friends/familiar faces are present.
  - **Familiar Faces Logic**: Auto-detects people you've reacted to or spent time with.
  - **Jittered Aggregation**: Counts are rounded (e.g., "5+") to prevent tracking.
  - **Granular Controls**: Global toggle and venue-specific suppression.
- **Success criteria**: Notifications appear in real-time...

### Seeded Content Analytics (Admin Tool)
- **Functionality**: Internal dashboard monitoring conversion of "Pre-Trending" venues and hashtag seeding health. Tracks time-to-first-activity and conversion rates for verified check-ins.
- **Purpose**: Measure effectiveness of initial content seeding and identify venues struggling to gain real-world momentum.
- **Trigger**: Admin accesses "Analytics Dashboard" from developer/admin settings.
- **Success criteria**: Displays real-time conversion rates for seeded venues, average hours to first activity, and individual venue status (Pre-Trending vs. Converted).

### Contextual Hashtag System
- **Functionality**: Dynamic hashtag suggestions based on venue category, time of day (Morning/Afternoon/Evening/Late Night), day of week, and current vibe/energy rating.
- **Purpose**: Reduce friction in pulse creation and standardize metadata for better discovery.
- **Trigger**: User opens "Create Pulse" dialog.
- **Success criteria**: Suggestions refresh as user changes energy slider; prioritized "Seeded" hashtags show first; automatic decay of hashtag scoring keeps trends fresh.

### UX Enhancements

#### Feed Experience
- **Pull-to-Refresh**: Drag gesture to refresh feeds with animated indicator showing pull progress
- **Skeleton Loading States**: Shimmer-effect placeholders matching card layouts during initial load
- **Empty State Illustrations**: Engaging visual empty states with icons, descriptions, and CTAs for no-pulses, no-notifications, and no-favorites scenarios

#### Engagement Features
- **First Pulse Celebration**: Confetti animation and "Pioneer" badge when user posts the first pulse at a venue
- **Streak Tracking**: Visual streak badge showing consecutive days of posting with fire emoji animation
- **Quick Reactions**: Compact reaction bar for single-tap reactions directly from feed without expanding cards

#### Mobile Polish
- **Extended Haptic Feedback**: Tactile feedback on reactions, favorites, and navigation (light/medium/heavy/success/error patterns)
- **Swipe Gestures**: Swipe left on pulse cards to reveal quick reactions; swipe right on notifications to dismiss

#### Map Experience
- **Near Me Filter**: One-tap button to filter venues within 0.5 mile walking distance
- **Live Activity Indicators**: Pulsing ring animation on map pins for venues with activity in the last 10 minutes

## Edge Case Handling

- **First Launch**: Show splash screen with welcome message and location permission request; persist onboarding completion state
- **Location Permission Denied on Onboarding**: Allow user to skip and still access app in browse-only mode
- **Location Denied**: Show prominent permission prompt explaining why location is required; gracefully degrade to browse-only mode
- **Cooldown Active**: Display countdown timer and last pulse when user tries to post too soon at same venue
- **No Nearby Venues**: Prompt user to add venue or show map of closest options within expanded radius
- **Media Upload Failure**: Save pulse without media and show retry option; don't block posting
- **Video Too Long**: Reject videos over 30 seconds with clear error message and duration display
- **Video Format Unsupported**: Handle unsupported formats gracefully with error message
- **Haptic Feedback Unavailable**: Gracefully degrade on devices without vibration support; functionality remains unchanged
- **Voice Search Not Supported**: Show disabled microphone icon with tooltip explaining browser compatibility; fall back to text-only search
- **Voice Filter Not Supported**: Hide voice filter button in filters panel when browser doesn't support speech recognition; manual filter buttons remain functional
- **Microphone Permission Denied**: Show error toast explaining permission needed; guide user to browser settings
- **No Speech Detected**: Show "No speech detected" message after brief timeout; allow retry
- **Voice Recognition Error**: Display error toast with retry option; search field remains functional for text input
- **Ambiguous Voice Command**: If voice filter command is unclear or doesn't match any filters, show toast with suggested commands and examples
- **Voice Command Success**: Show success toast with applied filter summary (e.g., "Filters applied: buzzing, electric • bars")
- **Offline Mode**: Queue pulses locally and sync when connection restored; show offline indicator
- **Stale Data**: Auto-refresh feeds every 30 seconds; show "New pulses available" banner
- **Empty Venue**: Show empty state encouraging user to post first pulse
- **Expired Pulses**: Visually fade older pulses and show "90 min ago" timestamp before removal
- **Unit System Change**: All distance displays update instantly when user switches between imperial/metric in settings
- **Empty Notifications**: Show friendly empty state explaining that notifications appear when friends are active
- **Notification Settings Off**: Respect user preferences and don't generate notifications for disabled categories
- **Grouped Notifications**: When multiple users react to the same pulse, combine into single notification showing up to 3 user avatars with overflow count
- **Venue Surge Detection**: Continuously monitor venue scores; trigger trending notifications when score reaches threshold with significant increase
- **Duplicate Surge Alerts**: Prevent spam by enforcing cooldown period between alerts for same venue; cap alerts per venue per session
- **Out of Range Surge**: Only notify for surging venues within 5-mile radius of user location
- **Surge Alert Disabled**: When trending venue notifications disabled in settings, venue surge tracker stops monitoring
- **Impact Notification Trigger**: Only fire when user's pulse directly causes threshold cross (check score before/after)
- **Followed Venue Limit**: Cap at 10 followed venues; show friendly error when limit reached with option to unfollow others
- **Score Transparency Panel Offline**: Show cached breakdown with "Last updated X ago" indicator
- **Pulse Pending State**: When offline or high latency, show pulse card immediately with "Sending..." badge and animated glow; update to confirmed state when successful
- **Failed Pulse Upload**: Show retry button on pulse card with error indicator; keep in pending state until user retries or dismisses
- **New User Credibility**: New accounts start with reduced credibility weight (0.5-0.7) to prevent fake account spam; weight increases naturally with genuine activity based on account age (1/7/30 days) and total verified pulses
- **Credibility Calculation Failure**: If credibility can't be calculated, default to 1.0 weight to avoid blocking pulses
- **Zero Check-In History**: Users without venue history don't get badges; functionality remains unchanged
- **Badge Overflow**: Maximum 2 badges displayed per pulse to prevent visual clutter; prioritize most relevant badges (Regular, Frequent, Veteran, Active Tonight, Return Visit, Trusted Source)
- **Pre-Trending Contextual Labels**: Venues in Pre-Trending state show smart labels like "Usually busy mornings" (Cafes), "Peak dining hours" (Food), or "Likely trending tonight" (Nightlife) based on category and time

## Design Direction

Pulse should feel like a nightclub visualizer meets a live dashboard — dark, electric, urgent. The design should pulse with energy, using motion and color to communicate intensity. Users should immediately feel the difference between a dead venue and an electric one through bold typography, animated gradients, and real-time score animations.

## Color Selection

Dark mode with high-energy accent colors that visualize venue intensity.

-   **Primary Color**: Electric Purple `oklch(0.65 0.25 300)` - Represents the app's energetic, nightlife vibe and serves as the main brand color for CTAs
-   **Secondary Colors**: 
    -   Deep Black `oklch(0.15 0 0)` - Primary background creating dramatic contrast
    -   Dark Gray `oklch(0.25 0 0)` - Card backgrounds and secondary surfaces
    -   Mid Gray `oklch(0.45 0 0)` - Borders and dividers
-   **Accent Color**: Neon Cyan `oklch(0.75 0.18 195)` - High-energy highlight for active states, trending indicators, and "Just Popped" badges
-   **Energy Gradient Colors**:
    -   Dead: `oklch(0.35 0.05 240)` (Dark Blue-Gray)
    -   Chill: `oklch(0.60 0.15 150)` (Soft Green)
    -   Buzzing: `oklch(0.70 0.22 60)` (Vibrant Yellow-Orange)
    -   Electric: `oklch(0.65 0.28 340)` (Hot Magenta)
-   **Foreground/Background Pairings**:
    -   Primary Purple on Deep Black - Ratio 5.2:1 ✓
    -   White `oklch(0.98 0 0)` on Deep Black - Ratio 14.8:1 ✓
    -   Light Gray `oklch(0.85 0 0)` on Dark Gray - Ratio 5.1:1 ✓
    -   Neon Cyan on Deep Black - Ratio 7.9:1 ✓

## Font Selection

Typography should feel modern, technical, and slightly futuristic to match the real-time data dashboard aesthetic.

-   **Typographic Hierarchy**:
    -   H1 (App Title/Venue Name): Space Grotesk Bold / 32px / tight letter-spacing (-0.02em)
    -   H2 (Section Headers): Space Grotesk Bold / 24px / normal spacing
    -   H3 (Venue Score): Space Grotesk Bold / 56px / tight spacing (large numerical display)
    -   Body (Captions/Content): Inter Medium / 15px / relaxed line-height (1.6)
    -   Label (Timestamps/Metadata): JetBrains Mono Regular / 12px / wide letter-spacing (0.05em) / uppercase
    -   Button Text: Space Grotesk SemiBold / 16px / normal spacing

## Animations

Animations should emphasize real-time activity and energy - use pulsing effects for live scores, smooth transitions for feed updates, and energetic springs for interactions.

Key animation moments:
-   Splash screen logo scales in with spring physics and glows
-   Welcome screen elements fade in sequentially with staggered delays
-   Location permission screen slides in from right with smooth transition
-   Permission icon has continuous pulsing rings expanding outward
-   Pulse score numbers count up/down with spring physics when updated
-   Energy slider glows and pulses as user drags with haptic feedback vibration at each energy level
-   Energy level indicator scales up when selected with color-coded glow
-   New pulses slide in from bottom with scale + fade
-   Trending badges pulse gently every 2 seconds
-   Map heatmap gradients animate smoothly when venue energy changes
-   Map pins pulse continuously for active venues with score > 0
-   User location indicator pulses on map to show current position
-   Venue tooltip cards fade in/out on hover with smooth slide up
-   Map zoom and pan transitions use smooth easing curves
-   Venue cards lift on hover with subtle shadow expansion
-   Loading states use expanding ripple effect, not spinners
-   Success states use quick scale + glow burst
-   Real-time indicators pulse continuously (heartbeat rhythm)

## Component Selection


- **Icon Selection**:
  - MapPin (venue locations)
  - TrendingUp (trending indicators)
  - Camera, VideoCamera (media upload)
  - Play (video playback indicators)
  - Lightning (electric energy)
  - Fire (hot/trending)
  - Users (friends/social)
  - Clock (recent activity)
  - Prohibit (blocked/cooldown)
  - Eye (views/engagement)
  - Plus (create pulse FAB)
  - Gear (settings navigation)
  - Ruler (distance units setting)
  - Info (informational messages)
  - Bell (notifications icon with badge)
  - CheckCircle (mark notifications as read)
  - MagnifyingGlass (text search)
  - Microphone (voice search and voice filter activation)
  - MicrophoneSlash (voice listening active state)

- **Spacing**:
  - Section padding: `p-6` (24px)
  - Card padding: `p-4` (16px)
  - Card gaps in feed: `gap-4` (16px)
  - Inline elements: `gap-2` (8px)
  - Button padding: `px-6 py-3`
  - Screen margins: `px-4` on mobile, `px-8` on desktop

- **Mobile**:
  - Single-column feed layout with full-width cards
  - Bottom tab navigation (Trending, Map, Notifications, Profile) with unread badge on Notifications
  - Full-screen create pulse flow as bottom sheet dialog
  - Floating action button for quick pulse creation
  - Touch-optimized 44px minimum tap targets
  - Dedicated venue page with sticky header showing venue name, category, distance, score, and favorite toggle
  - Venue page displays live energy score with score breakdown panel and chronological pulse feed
  - Swipeable image carousels for multi-photo pulses
  - Pull-to-refresh on feeds
  - Settings section integrated within Profile page (no separate Settings tab)
  - Profile page displays user info, favorite venues grid, user's pulses, and Settings section at bottom
  - Notification feed with filter toggle (All/Unread) and quick "Mark all read" action

---

## Current Status

### Completed Features
| Feature | Status | Notes |
|---------|--------|-------|
| Onboarding & Splash Screen | Done | First-launch flow with location permission |
| Location-Based Check-In | Done | GPS tracking with Haversine distance verification |
| Create Pulse | Done | Photos, video (compressed), energy ratings, hashtags |
| Real-Time Pulse Score | Done | Weighted algorithm with 90-min decay |
| Score Transparency Panel | Done | "Why this score?" expandable breakdown |
| Venue Discovery (Map + List) | Done | Interactive canvas map, heatmap, category icons, filters |
| Social Layer | Done | Friend following, emoji reactions |
| Venue Following | Partial | Backend logic done; UI (My Spots tab, follow button) not built |
| Settings & Preferences | Done | Imperial/metric toggle, notification prefs |
| Credibility & Trust Badges | Done | 6 badge types, weighted scoring |
| In-App Notifications | Done | 5 notification types with intelligent grouping |
| Social Pulse Correlation | Done | Admin dashboard with simulated Twitter/X ingestion |
| Contextual Hashtags | Done | Dynamic suggestions by category, time, energy |
| UX Enhancements | Done | Pull-to-refresh, skeletons, haptics, swipe gestures |
| Who's Here (Presence) | Done | Privacy-first proximity with jittered aggregation |
| Video Compression | Done | Client-side, 10MB/30s limits |
| Voice Search | Done | Venue search + voice-activated filters |
| Pending State Handling | Done | Optimistic UI with retry on failure |
| Venue Search | Done | Text search + category filtering |

### Known Gaps
- **No backend**: All data is client-side via Spark `useKV`; no database, no auth, no multi-device sync
- **No test coverage**: Zero test files; no testing framework installed
- **ESLint broken**: Missing `eslint.config.js` for ESLint v9 flat config format
- **No CI/CD**: No GitHub Actions workflows for automated testing or builds
- **Large components**: `App.tsx` (959 lines) and `InteractiveMap.tsx` (40KB) need decomposition
- **Mock data only**: Twitter/X API is simulated; all venue/user data is seeded

---

## Feature Roadmap

### Phase 1 — Complete the Core Experience
*Goal: Ship a fully functional MVP that a small group of users can actually use together.*

#### 1.1 My Spots Feed UI
- Add follow/unfollow star button on venue pages and venue cards
- Add "My Spots" toggle tab alongside "Friends" in social feed
- Display chronological pulse feed filtered to followed venues
- Show followed status badge on venue cards throughout the app

#### 1.2 Backend & Authentication
- Stand up a backend API (Node.js/Express or serverless functions)
- User authentication (OAuth via Google/Apple or magic link)
- PostgreSQL or Supabase database for persistent storage
- Migrate from `useKV` to real API calls with React Query
- Multi-device support with synced user state

#### 1.3 Real-Time Infrastructure
- WebSocket or SSE connections for live pulse feed updates
- Push notifications (Firebase Cloud Messaging / APNs)
- Real-time venue score broadcast to all connected clients
- Replace polling intervals with server-pushed events

#### 1.4 Code Quality Foundation
- Configure ESLint v9 flat config
- Add Vitest with unit tests for core engines (`pulse-engine`, `credibility`, `venue-trending`)
- Component tests for critical flows (Create Pulse, Check-In)
- Decompose `App.tsx` into route-level components with proper state management
- Set up GitHub Actions CI pipeline (lint, type-check, test, build)

### Phase 2 — Intelligence & Trust
*Goal: Make the scoring smarter, the content more trustworthy, and the discovery more personalized.*

#### 2.1 Time-Contextual Scoring
- Define category-specific peak hours (e.g., cafes peak mornings, bars peak evenings)
- Normalize scores relative to expected activity for time of day
- Add contextual labels: "Electric for a Tuesday afternoon" or "Heating up early"
- Prevent cafes from always losing to nightlife venues in raw score

#### 2.2 Map Progressive Disclosure
- Default map view shows top 5 nearby surging venues (not all venues)
- "Show full heatmap" CTA reveals complete overlay
- First-session guided discovery to prevent information overload
- Cluster pins at lower zoom levels to reduce visual noise

#### 2.3 Venue Recommendations
- "You might like" suggestions based on venue categories user frequents
- Time-aware recommendations (brunch spots in morning, bars at night)
- Friend activity signals ("3 friends pulsed here tonight")
- Personalized trending: weight trending list by user preferences

#### 2.4 Content Moderation
- Flag/report flow for inappropriate pulses
- Automated content screening for uploaded photos/videos
- Admin moderation queue for flagged content
- User blocking and mute functionality

### Phase 3 — Growth & Network Effects
*Goal: Build features that make the app more valuable as more people use it.*

#### 3.1 Real Social Graph
- Contact book import for friend discovery
- QR code / share link for adding friends at venues
- "People you may know" based on co-located check-ins
- Friend activity digest: daily summary of where friends went

#### 3.2 Venue Owner Tools
- Venue claim and verification flow
- Venue owner dashboard: pulse analytics, peak hours, demographics
- Promoted venue placement in trending list (clearly labeled)
- Respond to pulses / post venue announcements

#### 3.3 Events & Scheduling
- Event creation tied to venues (DJ sets, happy hours, game nights)
- "Going" / "Interested" RSVP to drive anticipatory engagement
- Event-based surge predictions ("Expected to be Electric at 10pm")
- Calendar integration for saved events

#### 3.4 Sharing & Virality
- Deep links to venue pages and individual pulses
- Instagram/TikTok story sharing with branded Pulse energy card
- "Share venue" with energy score preview card
- Invite friends with referral tracking

### Phase 4 — Scale & Polish
*Goal: Production-grade reliability, performance, and platform expansion.*

#### 4.1 Performance & Reliability
- Code splitting and lazy loading for all routes
- Service worker for offline-first pulse queue with background sync
- Image/video CDN with optimized delivery
- Database indexing and query optimization for venue lookups at scale
- Rate limiting and abuse prevention on API endpoints

#### 4.2 Analytics & Observability
- Event tracking for core loop completion (open -> check-in -> pulse -> discovery)
- Seeded content analytics dashboard (conversion rates, time-to-first-activity)
- Funnel analysis: onboarding completion, first pulse, 7-day retention
- Error tracking and performance monitoring (Sentry or similar)

#### 4.3 Platform Expansion
- Progressive Web App (PWA) with install prompt and home screen icon
- Native mobile wrapper (Capacitor or React Native) for App Store / Play Store
- Native push notifications and background location
- Camera and media picker integration via native APIs

#### 4.4 Accessibility & Internationalization
- Full ARIA labeling and screen reader support
- Keyboard navigation for all interactive elements
- High contrast mode option
- Internationalization (i18n) framework for multi-language support
- Right-to-left (RTL) layout support

### Phase 5 — Engagement & Retention
*Goal: Deepen user engagement and build long-term retention loops.*

#### 5.1 Pulse Stories & Highlights
- Ephemeral 24-hour pulse stories at the top of trending feed
- Venue highlights: curated best-of pulse collections by venue owners or top contributors
- "Tonight's recap" auto-generated story from a user's evening activity
- Story reactions with quick emoji responses

#### 5.2 Crew Mode (Group Check-Ins)
- Create a "crew" of 2-8 friends for a night out
- Shared check-in: one person checks in, crew members confirm
- Crew pulse: combined energy rating from all crew members (weighted average)
- Crew activity feed showing where the group has been tonight
- "Squad goals" badge when full crew checks in together

#### 5.3 Venue Challenges & Achievements
- Weekly venue challenges ("Check into 3 new coffee shops this week")
- Achievement system: Explorer (10 unique venues), Night Owl (5 late-night pulses), Trendsetter (first pulse at 3 venues that later surged)
- Seasonal achievements tied to local events or holidays
- Achievement showcase on user profile (opt-in display)

#### 5.4 Pulse Playlists & Mood Boards
- Curated collections of pulses by mood or theme ("Best Rooftop Vibes", "Late Night Eats")
- User-created mood boards from saved pulses
- Venue-curated playlists highlighting their best moments
- Shareable playlist cards for social media

### Phase 6 — Data Intelligence & Monetization
*Goal: Leverage data insights for user value and sustainable revenue.*

#### 6.1 Predictive Surge Engine
- Machine learning model trained on historical pulse data to predict venue surges
- "Expected to peak at 10pm" predictions on venue pages
- Smart notifications: "Based on patterns, Pike Brewing usually surges in 30 minutes"
- Weather and event correlation for improved predictions

#### 6.2 Personal Insights Dashboard
- Weekly activity summary: venues visited, energy contributed, miles explored
- "Your vibe type" analysis based on venue categories and energy ratings
- Heatmap of user's own activity patterns (time of day, day of week)
- Year-in-review: annual activity retrospective

#### 6.3 Venue Analytics Pro (Revenue)
- Premium analytics tier for venue owners (paid subscription)
- Competitor benchmarking: compare energy scores with nearby venues
- Customer flow analysis: where patrons go before/after visiting
- Optimal event timing recommendations based on historical data
- Integration with POS systems for revenue-to-energy correlation

#### 6.4 Promoted Discoveries (Revenue)
- Sponsored venue placements in "You Might Like" recommendations
- Promoted events in the events feed (clearly labeled as sponsored)
- Venue boost: pay to increase visibility during slow periods
- Performance-based pricing: cost per check-in or cost per pulse

#### 6.5 Neighborhood & City Scores
- Aggregate energy scores for neighborhoods and districts
- "Hottest neighborhood right now" leaderboard
- City-wide energy index tracking overall nightlife activity
- Multi-city expansion with city-level trending and comparisons

### Phase 7 — Platform & Ecosystem
*Goal: Build Pulse into a platform that others can build on.*

#### 7.1 Public API & Developer Platform
- RESTful API for venue energy data access
- Webhook subscriptions for surge events
- Developer portal with documentation and API keys
- Rate-limited free tier, paid plans for commercial use
- Use cases: ride-share surge pricing, event planning, restaurant apps

#### 7.2 Integration Ecosystem
- Uber/Lyft: "Get a ride to this venue" deep links with surge-aware timing
- Spotify: "Now playing" at venues with collaborative playlists
- OpenTable/Resy: reservation links on venue pages
- Google Maps: Pulse energy layer as a Maps extension
- Apple Shortcuts: "Where should I go tonight?" automation

#### 7.3 White-Label Solution
- Customizable Pulse-powered energy tracking for events and festivals
- Branded venue discovery for hotel chains, entertainment districts
- Campus edition for universities (dorm energy, library occupancy, dining halls)
- Corporate edition for office campuses (cafeteria buzz, meeting room energy)

### Future Considerations
- **Real Twitter/X API integration**: Replace simulated social ingestion with live API
- **Augmented reality**: AR venue energy overlay through phone camera
- **Wearable integration**: Apple Watch / WearOS companion app for quick pulse creation
- **Audio energy detection**: Ambient sound level analysis to auto-suggest energy ratings
- **Multi-city expansion**: City selector, region-specific trending, city-level analytics
- **API for third parties**: Public API for venue energy data (bars, event planners, ride-share)
