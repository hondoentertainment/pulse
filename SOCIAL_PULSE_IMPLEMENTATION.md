# Social Pulse Correlation System — Implementation Summary

## Overview

A real-time Social Pulse ingestion and correlation system that pulls posts from X (Twitter) for configurable hashtags and correlates that activity with existing Venue Pulse scores. This powers the Admin Social Pulse Dashboard for monitoring how social media activity relates to physical venue energy.

## Core Components Created

### 1. Data Models & Types (`src/lib/types.ts`)
- **SocialPost**: Stores X/Twitter posts with engagement metrics
- **TrackedHashtag**: Configuration for which hashtags to monitor
- **SocialPulseWindow**: Rolling time windows (5min/15min/60min) for social activity
- **VenuePulseWindow**: Rolling time windows for venue check-in activity
- **PulseCorrelation**: Correlation analysis results with lag detection
- **CorrelationInsight**: Aggregated insights for dashboard display

### 2. Social Pulse Engine (`src/lib/social-pulse-engine.ts`)
- **calculateSocialPulseScore()**: Converts posts into 0-100 score based on:
  - Volume (post count)
  - Engagement-weighted intensity (likes, replies, reposts)
  - Velocity (change vs previous window)
  - Recency weighting (newer posts matter more)
- **createSocialPulseWindow()**: Aggregates posts into time windows
- **createVenuePulseWindow()**: Aggregates venue pulses into time windows
- **calculatePearsonCorrelation()**: Statistical correlation between social and venue activity
- **detectLag()**: Identifies if social activity leads or follows venue energy
- **inferVenueFromText()**: Maps posts to venues via text matching
- **mapSocialPostToVenue()**: Three-level venue association (explicit mapping, geo-based, text-based)

### 3. Twitter Ingestion Service (`src/lib/twitter-ingestion.ts`)
- **TwitterIngestionService**: Simulated X API v2 polling (ready for real API integration)
- **fetchRecentPosts()**: Pulls recent posts for hashtags
- **pollHashtag()**: Automated polling with deduplication
- **retryWithBackoff()**: Retry logic with exponential backoff
- **Rate limit tracking**: Respects API limits with status monitoring
- **Post filtering**: Excludes retweets, non-English posts

### 4. React Hooks (`src/hooks/use-social-pulse.ts`)
- **useSocialPulseIngestion()**: Auto-polls tracked hashtags every 60 seconds
- **useSocialPulseWindows()**: Calculates rolling windows every 5 minutes
- **useVenuePulseWindows()**: Calculates venue activity windows
- **usePulseCorrelations()**: Computes correlations every 10 minutes

### 5. Social Buzz Detection (`src/hooks/use-social-buzz.ts`)
- **useSocialBuzzVenues()**: Identifies venues with strong social correlation
- Flags venues with correlation ≥0.6 and social score ≥40
- Can be used to display "Social Buzz" badges in UI

### 6. Admin Dashboard Components

#### **HashtagManager** (`src/components/HashtagManager.tsx`)
- Add/remove tracked hashtags
- Toggle active/inactive status
- Map hashtags to specific venues
- Shows last poll time and status

#### **SocialPulseGraph** (`src/components/SocialPulseGraph.tsx`)
- Real-time bar chart of Social Pulse scores
- Displays post count, engagement, and velocity metrics
- Shows score changes and trends
- Animated updates with hover tooltips

#### **CorrelationOverlayChart** (`src/components/CorrelationOverlayChart.tsx`)
- Overlays Social Pulse vs Venue Pulse on same chart
- Dual-line graph with gradient fills
- Shows both metrics over time for visual comparison
- SVG-based with smooth animations

#### **CorrelationInsights** (`src/components/CorrelationInsights.tsx`)
- Lists venues with correlation data
- Shows correlation strength (Low/Medium/High)
- Displays lag detection results
- "Social Buzz" badges for strong correlations
- Progress bars for 60min and 120min correlation coefficients

#### **SocialPulseDashboard** (`src/components/SocialPulseDashboard.tsx`)
- Main admin interface with three tabs:
  - **Overview**: Real-time graphs and comparisons
  - **Correlations**: Detailed correlation insights
  - **Settings**: Hashtag management
- Live stats: Active hashtags, total posts, recent posts
- Filter by hashtag or venue
- Auto-updates every 10 seconds
- "Last Update" timestamp indicator

### 7. Integration with Main App
- Added "Social Pulse Dashboard" button in Settings
- Admin access through Profile → Settings
- Dashboard accessible via `showAdminDashboard` state
- Seamless navigation back to main app

## Key Features Implemented

### ✅ Hashtag Ingestion (X/Twitter)
- Configure multiple tracked hashtags
- Simulated X API v2 Recent Search (ready for real API)
- Excludes retweets and non-English posts
- Stores post ID, text, timestamp, engagement metrics
- Deduplication by post ID
- Retry logic with exponential backoff
- Rate limit tracking and status display

### ✅ Social Pulse Scoring Engine
- Rolling time windows: 5min, 15min, 60min
- Volume calculation (post count)
- Engagement-weighted intensity
- Velocity (change vs previous window)
- Normalized 0-100 score
- Recency weighting (exponential decay)

### ✅ Venue Mapping Logic
- **Explicit hashtag-to-venue mapping** (admin configured)
- **Geo/place-based mapping** (when location data exists)
- **Text-based venue name inference** (keyword matching)
- Posts resolve to venue_id or "unassigned"

### ✅ Correlation Engine
- Time-series storage for both social and venue pulses
- Rolling Pearson correlation (60min and 120min windows)
- Lag detection (does social lead venue pulse?)
- Correlation strength classification (low/medium/high)
- Persists correlation metrics per venue

### ✅ Admin Dashboard UI
- Hashtag selector and configuration
- Real-time Social Pulse graph
- Venue Pulse vs Social Pulse overlay chart
- Correlation score indicators
- "Social Buzz" badge logic for venues
- Timestamped updates (10-second refresh)
- Dark mode optimized
- Data-forward analytics aesthetic
- Minimal, clean design

## Data Persistence
All data is stored using the `useKV` hook for persistence between sessions:
- `socialPosts`: All ingested social media posts
- `trackedHashtags`: Configured hashtags and mappings
- `socialPulseWindows`: Calculated social activity windows
- `venuePulseWindows`: Calculated venue activity windows
- `pulseCorrelations`: Correlation analysis results

## Performance Optimizations
- Automatic cleanup of old windows (>4 hours)
- Automatic cleanup of old correlations (>2 hours)
- Efficient deduplication using Set data structures
- Memoized calculations in React hooks
- Throttled updates (5-10 minute intervals)

## Non-Goals (As Specified)
- ❌ No user posting to X
- ❌ No sentiment analysis (hooks ready for future)
- ❌ No complex authentication (basic admin access only)

## Success Criteria Met
- ✅ Social Pulse updates automatically (60-second polling)
- ✅ Correlation updates without manual refresh (10-minute intervals)
- ✅ Clear visual indication when social activity is driving venue energy (Social Buzz badges)
- ✅ Scales to multiple hashtags and venues
- ✅ Rate limits respected with retry/backoff
- ✅ Real-time dashboard feel with live updates
- ✅ Correlation strength clearly indicated (Low/Medium/High)
- ✅ Lag detection shows timing relationships

## Next Steps / Future Enhancements
1. **Real X API Integration**: Replace simulated service with actual X API v2 calls
2. **Sentiment Analysis**: Add sentiment scoring to social posts
3. **Push Notifications**: Alert admins when strong correlations detected
4. **Historical Analysis**: Store long-term correlation trends
5. **Export Reports**: CSV/PDF export of correlation data
6. **Multi-Platform**: Extend to Instagram, TikTok, etc.
7. **Predictive Alerts**: ML model to predict venue surges based on social activity
8. **User-Facing Social Buzz**: Show "Trending on Social" badges to regular users

## Technical Architecture
```
User Input (Settings) → TrackedHashtag Configuration
                             ↓
Twitter API Polling ← TwitterIngestionService (60s interval)
                             ↓
                     SocialPost Storage
                             ↓
           useSocialPulseWindows (5min intervals)
                             ↓
                    SocialPulseWindow Storage
                             ↓
                    +------------------+
                    |                  |
            Social Windows      Venue Windows
                    |                  |
                    +------------------+
                             ↓
              usePulseCorrelations (10min intervals)
                             ↓
                  PulseCorrelation Storage
                             ↓
              Admin Dashboard Visualization
```

## Files

### Created

| File | Purpose |
|------|---------|
| `src/lib/social-pulse-engine.ts` | Core scoring and correlation logic |
| `src/lib/twitter-ingestion.ts` | API polling and data ingestion |
| `src/lib/demo-hashtags.ts` | Demo data for quick setup |
| `src/hooks/use-social-pulse.ts` | React hooks for data management |
| `src/hooks/use-social-buzz.ts` | Social buzz detection utility |
| `src/components/HashtagManager.tsx` | Hashtag configuration UI |
| `src/components/SocialPulseGraph.tsx` | Social activity visualization |
| `src/components/CorrelationOverlayChart.tsx` | Dual-line comparison chart |
| `src/components/CorrelationInsights.tsx` | Correlation results display |
| `src/components/SocialPulseDashboard.tsx` | Main admin dashboard |

### Modified

| File | Changes |
|------|---------|
| `src/lib/types.ts` | Extended with Social Pulse types |
| `src/App.tsx` | Added dashboard access state and navigation |
| `src/components/Settings.tsx` | Added dashboard access button |
| `PRD.md` | Updated with Social Pulse feature documentation |

## Related Documentation

- [PRD.md](PRD.md) — product requirements including Social Pulse feature spec
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and data flow
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) — core feature implementation details
