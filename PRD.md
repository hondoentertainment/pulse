# Pulse — Real-Time Venue Energy Tracker

Pulse shows users where the energy is happening right now by letting them check into venues and share the vibe through quick posts with photos, videos, and energy ratings.

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
- **Functionality**: Detects nearby venues using simulated GPS and allows users to check in only when physically present
- **Purpose**: Ensures authenticity and prevents fake posts from people not actually at the venue
- **Trigger**: User opens app, grants location permission, and taps a nearby venue
- **Progression**: App loads → Location detected → Nearby venues displayed → User selects venue → Geo-fence verified → Check-in confirmed
- **Success criteria**: Users can only create pulses for venues within simulated proximity; attempts to post from wrong location are blocked

### Create Pulse
- **Functionality**: Quick post creation with optional photos (up to 3), optional video (up to 30 seconds), required energy rating with haptic feedback, and optional caption
- **Purpose**: Captures the current vibe of a venue through multimedia and energy level with tactile feedback that enhances the selection experience
- **Trigger**: User checks into a venue
- **Progression**: Check-in verified → Energy slider (Dead/Chill/Buzzing/Electric) selected with haptic feedback on each level change → Optional media uploaded (photos or video, mutually exclusive) → Optional caption added → Pulse posted → Appears in feeds
- **Success criteria**: Pulses successfully save with all metadata, video duration validation enforces 30-second limit, display in venue feeds, contribute to energy score, and haptic feedback triggers appropriately on supported devices (light vibration for Dead/Chill, medium for Buzzing, heavy for Electric)

### Real-Time Pulse Score
- **Functionality**: Calculates live energy score based on recent pulse volume, energy ratings, engagement, and velocity
- **Purpose**: Shows which venues are hot right now, not yesterday
- **Trigger**: New pulse posted or engagement added
- **Progression**: Pulse created → Score algorithm runs → Weighted calculation (recency + energy rating + engagement) → Score updated → UI reflects new score → Old pulses decay after 90 minutes
- **Success criteria**: Scores update in real-time, reflect current activity accurately, and auto-decay old pulses

### Venue Discovery
- **Functionality**: Browse trending venues via interactive map view with energy heatmap, voice-enabled search, and voice-activated filters or list view with "Just Popped" surges
- **Purpose**: Help users find where the energy is happening right now through visual heat mapping, hands-free voice search, and voice-controlled filtering by energy level and category
- **Trigger**: User opens Trending tab or Map view, activates voice search with microphone button, or activates voice filter in map filters panel
- **Progression**: View loaded → Venues sorted by score → Interactive map with draggable canvas and zoom controls shows real-time color-coded energy heatmap → User hovers over venue pins for quick preview → User clicks venue OR taps microphone icon → Speaks venue name → Voice transcript populates search → Results filter instantly → User selects venue → Venue page opens OR User opens filters panel → Taps voice filter button → Speaks filter command (e.g., "show electric venues" or "filter bars and clubs") → Voice command parsed → Filters applied automatically → Map updates to show filtered results
- **Success criteria**: Trending list updates in real-time, interactive map visualizes energy density with gradient heatmap overlays, users can pan/zoom/navigate to any venue, tooltips show venue details on hover, voice recognition accurately transcribes venue names and filter commands, voice search works hands-free on supported browsers, voice filter understands natural language commands for energy levels (dead/chill/buzzing/electric) and categories, filters apply instantly after voice command completes, toast notifications confirm applied filters

### Social Layer
- **Functionality**: Follow friends, see their recent pulses, add emoji reactions
- **Purpose**: Adds social proof and helps users discover venues through trusted connections
- **Trigger**: User navigates to Friends feed or reacts to a pulse
- **Progression**: Friends feed opens → Recent friend pulses displayed → User taps emoji → Reaction saved → Count increments
- **Success criteria**: Friend activity updates in real-time, reactions are instant, no comment threads

### Settings & Preferences
- **Functionality**: Configure app preferences including imperial/metric unit system toggle and notification preferences
- **Purpose**: Personalize the app experience to match user's location and preferences
- **Trigger**: User navigates to Settings tab in bottom navigation
- **Progression**: Settings tab opened → Unit preference toggle displayed → User switches between Imperial (mi, ft) and Metric (km, m) → Preference saved → All distance displays update throughout app
- **Success criteria**: Unit preference persists across sessions, all distance displays (venue cards, map filters, venue details) update immediately to reflect chosen system

### In-App Notifications
- **Functionality**: Real-time feed of friend activity including friend pulses, reactions to user's pulses, friends nearby at venues, and trending venue alerts. Multiple reactions on the same pulse are intelligently grouped together.
- **Purpose**: Keep users connected to their friends' activity and discover trending venues through social proof while reducing notification clutter
- **Trigger**: Friend posts a pulse, reacts to user's pulse, checks into nearby venue, or venue becomes trending
- **Progression**: Notification created → Badge appears on Notifications tab → User taps Notifications → Feed displays recent activity with unread indicators → Multiple reactions to same pulse grouped with combined user avatars and reaction icons → User taps notification → Navigates to relevant venue or pulse → All grouped notifications marked as read
- **Success criteria**: Notifications appear in real-time, unread count displays on tab badge, tapping notification navigates to relevant content, notifications respect user's notification settings preferences, "Mark all read" clears unread status, multiple reactions on same pulse display as single grouped notification showing all reactors and reaction types

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

## Design Direction

Pulse should feel like a nightclub visualizer meets a live dashboard — dark, electric, urgent. The design should pulse with energy, using motion and color to communicate intensity. Users should immediately feel the difference between a dead venue and an electric one through bold typography, animated gradients, and real-time score animations.

## Color Selection

Dark mode with high-energy accent colors that visualize venue intensity.

- **Primary Color**: Electric Purple `oklch(0.65 0.25 300)` - Represents the app's energetic, nightlife vibe and serves as the main brand color for CTAs
- **Secondary Colors**: 
  - Deep Black `oklch(0.15 0 0)` - Primary background creating dramatic contrast
  - Dark Gray `oklch(0.25 0 0)` - Card backgrounds and secondary surfaces
  - Mid Gray `oklch(0.45 0 0)` - Borders and dividers
- **Accent Color**: Neon Cyan `oklch(0.75 0.18 195)` - High-energy highlight for active states, trending indicators, and "Just Popped" badges
- **Energy Gradient Colors**:
  - Dead: `oklch(0.35 0.05 240)` (Dark Blue-Gray)
  - Chill: `oklch(0.60 0.15 150)` (Soft Green)
  - Buzzing: `oklch(0.70 0.22 60)` (Vibrant Yellow-Orange)
  - Electric: `oklch(0.65 0.28 340)` (Hot Magenta)
- **Foreground/Background Pairings**:
  - Primary Purple on Deep Black - Ratio 5.2:1 ✓
  - White `oklch(0.98 0 0)` on Deep Black - Ratio 14.8:1 ✓
  - Light Gray `oklch(0.85 0 0)` on Dark Gray - Ratio 5.1:1 ✓
  - Neon Cyan on Deep Black - Ratio 7.9:1 ✓

## Font Selection

Typography should feel modern, technical, and slightly futuristic to match the real-time data dashboard aesthetic.

- **Typographic Hierarchy**:
  - H1 (App Title/Venue Name): Space Grotesk Bold / 32px / tight letter-spacing (-0.02em)
  - H2 (Section Headers): Space Grotesk Bold / 24px / normal spacing
  - H3 (Venue Score): Space Grotesk Bold / 56px / tight spacing (large numerical display)
  - Body (Captions/Content): Inter Medium / 15px / relaxed line-height (1.6)
  - Label (Timestamps/Metadata): JetBrains Mono Regular / 12px / wide letter-spacing (0.05em) / uppercase
  - Button Text: Space Grotesk SemiBold / 16px / normal spacing

## Animations

Animations should emphasize real-time activity and energy - use pulsing effects for live scores, smooth transitions for feed updates, and energetic springs for interactions.

Key animation moments:
- Splash screen logo scales in with spring physics and glows
- Welcome screen elements fade in sequentially with staggered delays
- Location permission screen slides in from right with smooth transition
- Permission icon has continuous pulsing rings expanding outward
- Pulse score numbers count up/down with spring physics when updated
- Energy slider glows and pulses as user drags with haptic feedback vibration at each energy level
- Energy level indicator scales up when selected with color-coded glow
- New pulses slide in from bottom with scale + fade
- Trending badges pulse gently every 2 seconds
- Map heatmap gradients animate smoothly when venue energy changes
- Map pins pulse continuously for active venues with score > 0
- User location indicator pulses on map to show current position
- Venue tooltip cards fade in/out on hover with smooth slide up
- Map zoom and pan transitions use smooth easing curves
- Venue cards lift on hover with subtle shadow expansion
- Loading states use expanding ripple effect, not spinners
- Success states use quick scale + glow burst
- Real-time indicators pulse continuously (heartbeat rhythm)

## Component Selection

- **Components**:
  - **Card**: Venue cards, pulse posts - dark variant with subtle borders and hover lift effect
  - **Button**: Primary actions (Create Pulse, Check In) - filled primary variant with glow effect
  - **Slider**: Energy rating selector - custom rail with gradient based on value
  - **Switch**: Unit system toggle in settings - primary color when active
  - **Tabs**: Navigation between Trending/Map/Friends - indicator bar with cyan accent
  - **Avatar**: User profiles - circular with online status indicator
  - **Badge**: "Just Popped", "Electric", energy labels - neon variants with pulse animation
  - **Dialog**: Full-screen create pulse flow - dark overlay with smooth slide-up
  - **ScrollArea**: Feeds and lists - invisible scrollbar, smooth momentum
  - **Separator**: Section dividers - subtle gray with glow effect
  - **Progress**: Upload progress, cooldown timer - gradient fill with pulse
  - **Skeleton**: Loading states for cards - animated shimmer gradient
  - **Label**: Form labels in settings - clear, readable typography

- **Customizations**:
  - Splash Screen: Custom two-step onboarding with animated logo, gradient backgrounds, pulsing location icon with expanding rings, and clear permission explanations
  - Energy Slider: Custom component with gradient rail, glowing thumb, emoji markers at each value
  - Pulse Score Display: Large animated number with pulsing glow ring
  - Interactive Map: Custom HTML5 Canvas-based visualization with draggable pan, pinch-zoom controls, radial gradient heatmap overlay showing energy intensity, clickable venue pins with hover tooltips, user location indicator, voice-enabled search with microphone button, voice-activated filters with natural language parsing, and energy legend
  - Venue Card: Custom design with large energy score, last active timestamp, preview images
  - Floating Action Button: Fixed bottom-right create pulse button with pulse animation
  - Grouped Notification Card: Shows overlapping user avatars (up to 3) with z-index stacking, combined reaction icons, and count of additional reactors
  - Video Player: Native HTML5 video controls with play overlay icon, duration badge, and 16:9 aspect ratio display in feed
  - Voice Search Button: Microphone icon that pulses and changes color when listening, disabled state for unsupported browsers
  - Voice Filter Button: Microphone icon in filters panel that pulses with cyan glow when listening, shows live transcript, provides example commands, and displays applied filters in toast notifications
  
- **States**:
  - Buttons: Rest (purple), Hover (lighter purple + glow), Active (darker + scale down), Disabled (gray 40% opacity)
  - Cards: Rest (dark gray), Hover (lift + border glow), Active (pressed down), Loading (shimmer overlay)
  - Inputs: Rest (dark border), Focus (cyan border + glow), Filled (purple border), Error (red border + shake)

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
  - Bottom tab navigation (Trending, Map, Notifications, Profile, Settings) with unread badge on Notifications
  - Full-screen create pulse flow as bottom sheet dialog
  - Floating action button for quick pulse creation
  - Touch-optimized 44px minimum tap targets
  - Sticky venue header on venue pages
  - Swipeable image carousels for multi-photo pulses
  - Pull-to-refresh on feeds
  - Settings page with clear sections and toggle controls for unit preferences
  - Notification feed with filter toggle (All/Unread) and quick "Mark all read" action
