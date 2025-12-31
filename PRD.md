# Pulse — Real-Time Venue Energy Tracker

Pulse shows users where the energy is happening right now by letting them check into venues and share the vibe through quick posts with photos, videos, and energy ratings.

**Experience Qualities**:
1. **Immediate** - Every interaction should feel instant, with real-time updates showing what's happening now, not five minutes ago
2. **Visceral** - Users should feel the energy of a place through bold visuals, pulsing animations, and high-energy design that mirrors the excitement they're tracking
3. **Authentic** - Location-verified posts and time-decay mechanics ensure what you see reflects current reality, not stale content

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
- This app requires real-time scoring, geolocation verification, media uploads, social features, multiple views (map, feed, venue pages), and a sophisticated algorithm for calculating venue energy scores

## Essential Features

### Location-Based Check-In
- **Functionality**: Detects nearby venues using simulated GPS and allows users to check in only when physically present
- **Purpose**: Ensures authenticity and prevents fake posts from people not actually at the venue
- **Trigger**: User opens app, grants location permission, and taps a nearby venue
- **Progression**: App loads → Location detected → Nearby venues displayed → User selects venue → Geo-fence verified → Check-in confirmed
- **Success criteria**: Users can only create pulses for venues within simulated proximity; attempts to post from wrong location are blocked

### Create Pulse
- **Functionality**: Quick post creation with optional photos/video, required energy rating, and optional caption
- **Purpose**: Captures the current vibe of a venue through multimedia and energy level
- **Trigger**: User checks into a venue
- **Progression**: Check-in verified → Energy slider (Dead/Chill/Buzzing/Electric) selected → Optional media uploaded → Optional caption added → Pulse posted → Appears in feeds
- **Success criteria**: Pulses successfully save with all metadata, display in venue feeds, and contribute to energy score

### Real-Time Pulse Score
- **Functionality**: Calculates live energy score based on recent pulse volume, energy ratings, engagement, and velocity
- **Purpose**: Shows which venues are hot right now, not yesterday
- **Trigger**: New pulse posted or engagement added
- **Progression**: Pulse created → Score algorithm runs → Weighted calculation (recency + energy rating + engagement) → Score updated → UI reflects new score → Old pulses decay after 90 minutes
- **Success criteria**: Scores update in real-time, reflect current activity accurately, and auto-decay old pulses

### Venue Discovery
- **Functionality**: Browse trending venues via map view with energy heatmap or list view with "Just Popped" surges
- **Purpose**: Help users find where the energy is happening right now
- **Trigger**: User opens Trending tab or Map view
- **Progression**: View loaded → Venues sorted by score → Map shows color-coded energy levels → User selects venue → Venue page opens
- **Success criteria**: Trending list updates in real-time, map visualizes energy density, users can navigate to any venue

### Social Layer
- **Functionality**: Follow friends, see their recent pulses, add emoji reactions
- **Purpose**: Adds social proof and helps users discover venues through trusted connections
- **Trigger**: User navigates to Friends feed or reacts to a pulse
- **Progression**: Friends feed opens → Recent friend pulses displayed → User taps emoji → Reaction saved → Count increments
- **Success criteria**: Friend activity updates in real-time, reactions are instant, no comment threads

## Edge Case Handling

- **Location Denied**: Show prominent permission prompt explaining why location is required; gracefully degrade to browse-only mode
- **Cooldown Active**: Display countdown timer and last pulse when user tries to post too soon at same venue
- **No Nearby Venues**: Prompt user to add venue or show map of closest options within expanded radius
- **Media Upload Failure**: Save pulse without media and show retry option; don't block posting
- **Offline Mode**: Queue pulses locally and sync when connection restored; show offline indicator
- **Stale Data**: Auto-refresh feeds every 30 seconds; show "New pulses available" banner
- **Empty Venue**: Show empty state encouraging user to post first pulse
- **Expired Pulses**: Visually fade older pulses and show "90 min ago" timestamp before removal

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
- Pulse score numbers count up/down with spring physics when updated
- Energy slider glows and pulses as user drags
- New pulses slide in from bottom with scale + fade
- Trending badges pulse gently every 2 seconds
- Map pins bounce when tapped
- Venue cards lift on hover with subtle shadow expansion
- Loading states use expanding ripple effect, not spinners
- Success states use quick scale + glow burst
- Real-time indicators pulse continuously (heartbeat rhythm)

## Component Selection

- **Components**:
  - **Card**: Venue cards, pulse posts - dark variant with subtle borders and hover lift effect
  - **Button**: Primary actions (Create Pulse, Check In) - filled primary variant with glow effect
  - **Slider**: Energy rating selector - custom rail with gradient based on value
  - **Tabs**: Navigation between Trending/Map/Friends - indicator bar with cyan accent
  - **Avatar**: User profiles - circular with online status indicator
  - **Badge**: "Just Popped", "Electric", energy labels - neon variants with pulse animation
  - **Dialog**: Full-screen create pulse flow - dark overlay with smooth slide-up
  - **ScrollArea**: Feeds and lists - invisible scrollbar, smooth momentum
  - **Separator**: Section dividers - subtle gray with glow effect
  - **Progress**: Upload progress, cooldown timer - gradient fill with pulse
  - **Skeleton**: Loading states for cards - animated shimmer gradient

- **Customizations**:
  - Energy Slider: Custom component with gradient rail, glowing thumb, emoji markers at each value
  - Pulse Score Display: Large animated number with pulsing glow ring
  - Map Heatmap: Custom D3 visualization showing energy density with color intensity
  - Venue Card: Custom design with large energy score, last active timestamp, preview images
  - Floating Action Button: Fixed bottom-right create pulse button with pulse animation
  
- **States**:
  - Buttons: Rest (purple), Hover (lighter purple + glow), Active (darker + scale down), Disabled (gray 40% opacity)
  - Cards: Rest (dark gray), Hover (lift + border glow), Active (pressed down), Loading (shimmer overlay)
  - Inputs: Rest (dark border), Focus (cyan border + glow), Filled (purple border), Error (red border + shake)

- **Icon Selection**:
  - MapPin (venue locations)
  - TrendingUp (trending indicators)
  - Camera, Video (media upload)
  - Lightning (electric energy)
  - Fire (hot/trending)
  - Users (friends/social)
  - Clock (recent activity)
  - Prohibit (blocked/cooldown)
  - Eye (views/engagement)
  - Plus (create pulse FAB)

- **Spacing**:
  - Section padding: `p-6` (24px)
  - Card padding: `p-4` (16px)
  - Card gaps in feed: `gap-4` (16px)
  - Inline elements: `gap-2` (8px)
  - Button padding: `px-6 py-3`
  - Screen margins: `px-4` on mobile, `px-8` on desktop

- **Mobile**:
  - Single-column feed layout with full-width cards
  - Bottom tab navigation (Trending, Map, Create, Friends, Profile)
  - Full-screen create pulse flow as bottom sheet dialog
  - Floating action button for quick pulse creation
  - Touch-optimized 44px minimum tap targets
  - Sticky venue header on venue pages
  - Swipeable image carousels for multi-photo pulses
  - Pull-to-refresh on feeds
