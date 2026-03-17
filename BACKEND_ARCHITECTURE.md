# Backend Architecture

This document defines the server-side architecture for Pulse, covering data models, authentication, API design, database strategy, and real-time infrastructure.

It builds on the gaps identified in [SECURITY.md](./SECURITY.md) and the rollout phases in [PRODUCTION_ROLLOUT.md](./PRODUCTION_ROLLOUT.md).

---

## Data Models

All server-side schemas use UUIDs for primary keys and ISO 8601 timestamps. Fields marked **server-computed** are never accepted from the client; fields marked **client-supplied** are provided in request bodies.

### User

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| email | string | client-supplied | Unique, used for email/password auth |
| username | string | client-supplied | Unique, 3-30 chars, alphanumeric + underscores |
| display_name | string \| null | client-supplied | Optional display name |
| profile_photo_url | string \| null | client-supplied | CDN URL after upload |
| auth_provider | enum(`email`, `google`, `apple`) | server-computed | Set during registration |
| password_hash | string \| null | server-computed | bcrypt hash, null for OAuth users |
| role | enum(`user`, `venue_owner`, `admin`) | server-computed | Default `user` |
| credibility_score | float | server-computed | Range 0.5-2.0, default 0.7 for new users |
| presence_enabled | boolean | client-supplied | Default true |
| presence_visibility | enum(`everyone`, `friends`, `off`) | client-supplied | Default `friends` |
| hide_at_sensitive_venues | boolean | client-supplied | Default false |
| unit_system | enum(`imperial`, `metric`) | client-supplied | Default `imperial` |
| notification_preferences | jsonb | client-supplied | Per-category toggles |
| created_at | timestamp | server-computed | |
| updated_at | timestamp | server-computed | |
| last_login_at | timestamp | server-computed | |

**Relationships:**
- 1:many -> Pulse
- 1:many -> Notification
- many:many -> User (friends, via `user_friends` join table)
- many:many -> Venue (followed venues, via `user_followed_venues` join table, max 10)
- 1:many -> UserAchievement
- many:many -> Crew (via `crew_members` join table)

### Venue

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| name | string | client-supplied | Venue name |
| location | geography(Point, 4326) | client-supplied | PostGIS point |
| address | string | client-supplied | Street address |
| city | string | server-computed | Derived from geocoding or client input |
| state | string | server-computed | Derived from geocoding or client input |
| category | string | client-supplied | e.g. Bar, Nightclub, Cafe, Music Venue |
| phone | string \| null | client-supplied | |
| website | string \| null | client-supplied | |
| hours | jsonb \| null | client-supplied | Day-of-week operating hours |
| pulse_score | float | server-computed | Calculated by scoring engine, 0-100 |
| score_velocity | float | server-computed | Rate of score change |
| last_pulse_at | timestamp \| null | server-computed | Timestamp of most recent pulse |
| last_activity_at | timestamp \| null | server-computed | Timestamp of any activity |
| pre_trending | boolean | server-computed | Seeded venue flag |
| pre_trending_label | string \| null | server-computed | Contextual label |
| seeded | boolean | server-computed | Whether venue was seed data |
| verified_check_in_count | int | server-computed | Accumulated count |
| first_real_check_in_at | timestamp \| null | server-computed | First non-seeded check-in |
| owner_user_id | UUID \| null | server-computed | FK to User for claimed venues |
| integrations | jsonb \| null | client-supplied | Spotify, OpenTable, Maps links |
| created_at | timestamp | server-computed | |
| updated_at | timestamp | server-computed | |

**Relationships:**
- 1:many -> Pulse
- 1:many -> VenueEvent
- 1:many -> PulseStory
- 1:many -> VenueHighlight
- 1:many -> PulsePlaylist (venue-curated)
- many:many -> User (followers, via `user_followed_venues`)

### Pulse

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| user_id | UUID | server-computed | FK to User, from auth session |
| venue_id | UUID | client-supplied | FK to Venue |
| energy_rating | enum(`dead`, `chill`, `buzzing`, `electric`) | client-supplied | Required |
| caption | string \| null | client-supplied | Optional, max 280 chars |
| photos | text[] | client-supplied | Up to 3 CDN URLs |
| video_url | string \| null | client-supplied | CDN URL, max 30s/10MB |
| hashtags | text[] | client-supplied | Selected from suggestions |
| views | int | server-computed | Incremented on view |
| credibility_weight | float | server-computed | Snapshot of user credibility at post time |
| is_first_at_venue | boolean | server-computed | Pioneer badge trigger |
| expires_at | timestamp | server-computed | created_at + 90 minutes |
| created_at | timestamp | server-computed | |

**Relationships:**
- many:1 -> User
- many:1 -> Venue
- 1:many -> Reaction

### Reaction

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| pulse_id | UUID | client-supplied | FK to Pulse |
| user_id | UUID | server-computed | FK to User, from auth session |
| reaction_type | enum(`fire`, `eyes`, `skull`, `lightning`) | client-supplied | |
| created_at | timestamp | server-computed | |

**Unique constraint:** (pulse_id, user_id, reaction_type) -- one reaction type per user per pulse.

**Relationships:**
- many:1 -> Pulse
- many:1 -> User

### PulseStory

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| user_id | UUID | server-computed | From auth session |
| venue_id | UUID | client-supplied | FK to Venue |
| energy_rating | enum | client-supplied | |
| caption | string \| null | client-supplied | |
| photos | text[] | client-supplied | |
| expires_at | timestamp | server-computed | created_at + 24 hours |
| view_count | int | server-computed | |
| created_at | timestamp | server-computed | |

**Relationships:**
- many:1 -> User
- many:1 -> Venue
- 1:many -> StoryReaction (separate table)
- many:many -> User (viewed_by, via `story_views` join table)

### VenueEvent

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| venue_id | UUID | client-supplied | FK to Venue |
| created_by_user_id | UUID | server-computed | FK to User, from auth session |
| title | string | client-supplied | |
| description | string | client-supplied | |
| category | enum(`dj_set`, `happy_hour`, `game_night`, `live_music`, `trivia`, `open_mic`, `karaoke`, `comedy`, `other`) | client-supplied | |
| start_time | timestamp | client-supplied | |
| end_time | timestamp | client-supplied | |
| cover_charge | decimal \| null | client-supplied | |
| image_url | string \| null | client-supplied | CDN URL |
| recurring | jsonb \| null | client-supplied | frequency, dayOfWeek |
| predicted_peak_time | timestamp \| null | server-computed | From surge prediction engine |
| predicted_energy | enum \| null | server-computed | |
| created_at | timestamp | server-computed | |
| updated_at | timestamp | server-computed | |

**Relationships:**
- many:1 -> Venue
- many:1 -> User (creator)
- 1:many -> EventRSVP

### EventRSVP

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| event_id | UUID | client-supplied | FK to VenueEvent |
| user_id | UUID | server-computed | From auth session |
| status | enum(`going`, `interested`, `not_going`) | client-supplied | |
| created_at | timestamp | server-computed | |
| updated_at | timestamp | server-computed | |

**Unique constraint:** (event_id, user_id)

### Notification

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| user_id | UUID | server-computed | Recipient |
| type | enum(`friend_pulse`, `pulse_reaction`, `friend_nearby`, `trending_venue`, `impact`) | server-computed | |
| actor_user_id | UUID \| null | server-computed | User who triggered it |
| pulse_id | UUID \| null | server-computed | Related pulse |
| venue_id | UUID \| null | server-computed | Related venue |
| reaction_type | enum \| null | server-computed | For pulse_reaction type |
| energy_threshold | enum \| null | server-computed | For impact type |
| read | boolean | server-computed | Default false |
| created_at | timestamp | server-computed | |

**Relationships:**
- many:1 -> User (recipient)
- many:1 -> User (actor)
- many:1 -> Pulse (optional)
- many:1 -> Venue (optional)

### Crew

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| name | string | client-supplied | |
| created_by_user_id | UUID | server-computed | From auth session |
| active_night | date \| null | server-computed | Set when a crew check-in starts |
| created_at | timestamp | server-computed | |

**Relationships:**
- many:many -> User (via `crew_members`, 2-8 members)
- 1:many -> CrewCheckIn

### CrewCheckIn

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | |
| crew_id | UUID | client-supplied | FK to Crew |
| venue_id | UUID | client-supplied | FK to Venue |
| initiator_user_id | UUID | server-computed | |
| combined_energy_rating | enum \| null | server-computed | Weighted average after confirmations |
| status | enum(`pending`, `active`, `completed`) | server-computed | |
| created_at | timestamp | server-computed | |

### PulsePlaylist

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | Primary key |
| title | string | client-supplied | |
| description | string | client-supplied | |
| type | enum(`curated`, `user`, `venue`) | server-computed | |
| created_by_user_id | UUID | server-computed | |
| venue_id | UUID \| null | client-supplied | For venue-type playlists |
| cover_photo_url | string \| null | client-supplied | |
| mood | string \| null | client-supplied | |
| tags | text[] | client-supplied | |
| published | boolean | client-supplied | Default false |
| created_at | timestamp | server-computed | |
| updated_at | timestamp | server-computed | |

**Relationships:**
- many:1 -> User (creator)
- many:1 -> Venue (optional)
- many:many -> Pulse (via `playlist_pulses` join table, ordered)
- many:many -> User (likes, via `playlist_likes` join table)

### Achievement

| Field | Type | Source | Notes |
|---|---|---|---|
| id | string | server-computed | e.g. `explorer_10`, `night_owl_5` |
| name | string | server-computed | Display name |
| description | string | server-computed | |
| icon | string | server-computed | Emoji or icon reference |
| category | enum(`exploration`, `nightlife`, `social`, `consistency`, `special`) | server-computed | |
| tier | enum(`bronze`, `silver`, `gold`) | server-computed | |
| requirement | int | server-computed | Threshold to unlock |
| seasonal | boolean | server-computed | |

This is a reference table seeded by migrations. All fields are server-managed.

### UserAchievement

| Field | Type | Source | Notes |
|---|---|---|---|
| id | UUID | server-computed | |
| user_id | UUID | server-computed | FK to User |
| achievement_id | string | server-computed | FK to Achievement |
| progress | int | server-computed | Current progress toward requirement |
| unlocked_at | timestamp \| null | server-computed | Null until achieved |
| showcased | boolean | client-supplied | Whether to display on profile |

**Unique constraint:** (user_id, achievement_id)

---

## Auth Strategy

### Providers

1. **Google OAuth 2.0** -- primary social login for Android and web users
2. **Apple Sign In** -- required for iOS, uses OAuth 2.0 flow
3. **Email/password fallback** -- bcrypt-hashed passwords with email verification

### Token Architecture

- **Access token**: JWT, 15-minute expiry, contains `{ userId, role, sessionId }`
- **Refresh token**: opaque token stored in database, 30-day expiry, rotated on each use
- Access tokens are sent via `Authorization: Bearer <token>` header
- Refresh tokens are sent via HTTP-only secure cookie or dedicated refresh endpoint

### Session Management

- Sessions are stored in a `sessions` table with: id, user_id, refresh_token_hash, device_info, ip_address, created_at, expires_at, revoked
- Logout revokes the session and invalidates the refresh token
- Concurrent sessions allowed (multi-device support)
- Admin can revoke all sessions for a user

### Role-Based Access Control

Three roles: `user`, `venue_owner`, `admin`.

#### Permission Matrix

| Action | user | venue_owner | admin |
|---|---|---|---|
| Create pulse | Yes (own, geo-verified) | Yes (own, geo-verified) | Yes |
| Read pulses | Yes (public) | Yes (public) | Yes (all) |
| React to pulse | Yes | Yes | Yes |
| Delete pulse | Own only | Own only | Any |
| Create/edit venue | No | Owned venues only | Any |
| Claim venue | Request only | Already owns | Approve/reject |
| Create event | No | Owned venues only | Any |
| RSVP to event | Yes | Yes | Yes |
| Manage crew | Yes (own crews) | Yes (own crews) | Any |
| View notifications | Own only | Own only | N/A |
| Access admin dashboard | No | No | Yes |
| Moderate content | No | No | Yes |
| View analytics | Own profile | Owned venues | All |
| Manage API keys | No | Yes (own) | Yes (all) |
| Configure webhooks | No | Yes (own) | Yes (all) |
| Ban/suspend users | No | No | Yes |

### Security Controls

- Rate limit login attempts: 5 per minute per IP, 10 per minute per email
- Account lockout after 10 failed attempts (30-minute cooldown)
- Require email verification for email/password accounts before first pulse
- CSRF protection on all state-changing endpoints
- All tokens transmitted over HTTPS only

---

## API Design

Base URL: `/api/v1`

All responses follow a standard envelope:

```json
{
  "data": { ... },
  "meta": { "page": 1, "perPage": 20, "total": 100 },
  "error": null
}
```

Error responses:

```json
{
  "data": null,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired token" }
}
```

### Auth Endpoints

#### POST /api/v1/auth/register

```
Request:
{
  "email": "user@example.com",
  "username": "nightowl",
  "password": "securepassword123"
}

Response 201:
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "username": "nightowl", "role": "user" },
    "accessToken": "eyJ...",
    "refreshToken": "rt_..."
  }
}
```

#### POST /api/v1/auth/login

```
Request:
{
  "email": "user@example.com",
  "password": "securepassword123"
}

Response 200:
{
  "data": {
    "user": { "id": "uuid", "username": "nightowl", "role": "user" },
    "accessToken": "eyJ...",
    "refreshToken": "rt_..."
  }
}
```

#### POST /api/v1/auth/oauth

```
Request:
{
  "provider": "google",
  "idToken": "google-id-token..."
}

Response 200:
{
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "rt_...",
    "isNewUser": true
  }
}
```

#### POST /api/v1/auth/refresh

```
Request:
{
  "refreshToken": "rt_..."
}

Response 200:
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "rt_new_..."
  }
}
```

#### POST /api/v1/auth/logout

```
Headers: Authorization: Bearer <accessToken>

Response 204: (no body)
```

### Venue Endpoints

#### GET /api/v1/venues

Query params: `lat`, `lng`, `radius` (miles, default 5), `category`, `minScore`, `page`, `perPage`

```
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "name": "Neumos",
      "category": "Music Venue",
      "location": { "lat": 47.6145, "lng": -122.3205 },
      "address": "925 E Pike St, Seattle, WA",
      "pulseScore": 85,
      "lastPulseAt": "2026-03-17T02:30:00Z",
      "distance": 0.3
    }
  ],
  "meta": { "page": 1, "perPage": 20, "total": 45 }
}
```

#### GET /api/v1/venues/:id

```
Response 200:
{
  "data": {
    "id": "uuid",
    "name": "Neumos",
    "category": "Music Venue",
    "location": { "lat": 47.6145, "lng": -122.3205 },
    "address": "925 E Pike St, Seattle, WA",
    "city": "Seattle",
    "state": "WA",
    "pulseScore": 85,
    "scoreVelocity": 12.5,
    "lastPulseAt": "2026-03-17T02:30:00Z",
    "hours": { "monday": "Closed", "friday": "8:00 PM - 2:00 AM" },
    "phone": "(206) 709-9442",
    "website": "https://neumos.com",
    "integrations": { ... },
    "followerCount": 234,
    "isFollowing": true
  }
}
```

#### GET /api/v1/venues/nearby

Query params: `lat` (required), `lng` (required), `radius` (default 1 mile)

Returns venues sorted by distance, filtered to the given radius.

#### GET /api/v1/venues/trending

Query params: `city`, `limit` (default 20)

Returns venues grouped by trending category:
- `trending_now`: multi-user activity
- `just_popped`: rapid surge
- `gaining_energy`: building momentum

#### POST /api/v1/venues (venue_owner, admin)

```
Request:
{
  "name": "New Venue",
  "location": { "lat": 47.61, "lng": -122.33 },
  "address": "123 Main St",
  "category": "Bar",
  "hours": { ... }
}

Response 201:
{
  "data": { "id": "uuid", "name": "New Venue", ... }
}
```

### Pulse Endpoints

#### POST /api/v1/pulses

Requires geo-verification: client sends current lat/lng, server validates proximity to venue.

```
Request (multipart/form-data):
{
  "venueId": "uuid",
  "energyRating": "buzzing",
  "caption": "This place is on fire tonight",
  "hashtags": ["#fridayvibes", "#livemusic"],
  "lat": 47.6145,
  "lng": -122.3205,
  "photos": [File, File],
  "video": File
}

Response 201:
{
  "data": {
    "id": "uuid",
    "venueId": "uuid",
    "energyRating": "buzzing",
    "caption": "This place is on fire tonight",
    "photos": ["https://cdn.pulse.app/..."],
    "hashtags": ["#fridayvibes", "#livemusic"],
    "credibilityWeight": 1.2,
    "isFirstAtVenue": false,
    "createdAt": "2026-03-17T02:30:00Z",
    "expiresAt": "2026-03-17T04:00:00Z"
  }
}
```

Server-side on create:
1. Verify user location is within CHECK_IN_RADIUS_MILES of venue
2. Check cooldown (120 min at same venue)
3. Upload media to CDN, compress video if needed
4. Snapshot user credibility_score as credibility_weight
5. Recalculate venue pulse_score
6. Emit WebSocket event for live feed updates
7. Generate notifications (friend_pulse, impact if threshold crossed)

#### GET /api/v1/pulses

Query params: `venueId`, `userId`, `friendsOnly` (bool), `page`, `perPage`

#### POST /api/v1/pulses/:id/reactions

```
Request:
{
  "reactionType": "fire"
}

Response 201:
{
  "data": { "id": "uuid", "reactionType": "fire", "createdAt": "..." }
}
```

#### DELETE /api/v1/pulses/:id/reactions/:reactionType

Removes the authenticated user's reaction of the given type.

### User Endpoints

#### GET /api/v1/users/me

Returns the authenticated user's full profile.

#### PATCH /api/v1/users/me

```
Request:
{
  "username": "newname",
  "unitSystem": "metric",
  "presenceEnabled": true,
  "presenceVisibility": "friends"
}

Response 200:
{
  "data": { "id": "uuid", "username": "newname", ... }
}
```

#### GET /api/v1/users/:id

Public profile view (limited fields).

#### GET /api/v1/users/:id/pulses

Paginated list of a user's pulses.

#### POST /api/v1/users/:id/follow

Follow a user (add to friends).

#### DELETE /api/v1/users/:id/follow

Unfollow a user.

#### GET /api/v1/users/me/achievements

```
Response 200:
{
  "data": [
    {
      "achievementId": "explorer_10",
      "name": "Explorer",
      "description": "Visit 10 unique venues",
      "tier": "bronze",
      "progress": 7,
      "requirement": 10,
      "unlockedAt": null,
      "showcased": false
    }
  ]
}
```

#### GET /api/v1/users/me/followed-venues

Returns the user's followed venues (max 10).

#### POST /api/v1/users/me/followed-venues

```
Request: { "venueId": "uuid" }
```

#### DELETE /api/v1/users/me/followed-venues/:venueId

### Event Endpoints

#### GET /api/v1/events

Query params: `venueId`, `startAfter`, `startBefore`, `category`, `page`, `perPage`

#### GET /api/v1/events/:id

Includes RSVP counts and the authenticated user's RSVP status.

#### POST /api/v1/events (venue_owner for own venue, admin)

```
Request:
{
  "venueId": "uuid",
  "title": "Friday Night DJ Set",
  "description": "...",
  "category": "dj_set",
  "startTime": "2026-03-20T22:00:00Z",
  "endTime": "2026-03-21T02:00:00Z",
  "coverCharge": 15.00
}

Response 201:
{
  "data": { "id": "uuid", "title": "Friday Night DJ Set", ... }
}
```

#### POST /api/v1/events/:id/rsvp

```
Request: { "status": "going" }
```

#### DELETE /api/v1/events/:id/rsvp

### Notification Endpoints

#### GET /api/v1/notifications

Query params: `unreadOnly` (bool), `page`, `perPage`

Returns notifications with grouped reactions. Multiple reactions on the same pulse from different users are combined into a single grouped notification entry.

#### POST /api/v1/notifications/mark-read

```
Request: { "notificationIds": ["uuid", "uuid"] }
```

#### POST /api/v1/notifications/mark-all-read

### Admin Endpoints

All admin endpoints require `role: admin`.

#### GET /api/v1/admin/moderation/queue

Flagged content awaiting review.

#### POST /api/v1/admin/moderation/:pulseId/action

```
Request: { "action": "remove" | "approve" | "warn", "reason": "..." }
```

#### GET /api/v1/admin/analytics/overview

Dashboard data: active users, pulses created, venues active, trending metrics.

#### GET /api/v1/admin/analytics/venues/:id

Detailed venue analytics: conversion rates, time-to-first-activity, seeded hashtag performance.

#### GET /api/v1/admin/users

User management with search, filter by role, suspension status.

#### POST /api/v1/admin/users/:id/suspend

```
Request: { "reason": "...", "duration": "7d" }
```

### Proxy Endpoints

See `server/routes/proxy.ts` for implementation details.

#### GET /api/proxy/geocode

Proxies reverse geocoding to Nominatim with server-side rate limiting.

#### POST /api/proxy/webhook

Signs and forwards webhook payloads using server-side secrets.

---

## Database

### Engine

**PostgreSQL 15+** with the **PostGIS** extension for geospatial queries.

PostGIS enables:
- `ST_DWithin` for proximity checks (check-in radius verification)
- `ST_Distance` for distance calculations (nearby venue sorting)
- `ST_MakePoint` for storing venue coordinates
- Spatial indexing via GiST for sub-millisecond geo queries

### Key Indexes

```sql
-- Venue geospatial lookups (nearby, check-in radius)
CREATE INDEX idx_venues_location ON venues USING GIST (location);

-- Venue trending and discovery
CREATE INDEX idx_venues_pulse_score ON venues (pulse_score DESC);
CREATE INDEX idx_venues_category ON venues (category);
CREATE INDEX idx_venues_city_score ON venues (city, pulse_score DESC);

-- Pulse feeds (venue feed, user feed, expiry cleanup)
CREATE INDEX idx_pulses_venue_created ON pulses (venue_id, created_at DESC);
CREATE INDEX idx_pulses_user_created ON pulses (user_id, created_at DESC);
CREATE INDEX idx_pulses_expires_at ON pulses (expires_at);

-- Reactions for aggregation
CREATE INDEX idx_reactions_pulse ON reactions (pulse_id);

-- Notifications for user feed
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read, created_at DESC);

-- Events by venue and time
CREATE INDEX idx_events_venue_start ON venue_events (venue_id, start_time);

-- Sessions for auth lookups
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions (refresh_token_hash);

-- Friends graph
CREATE INDEX idx_user_friends_user ON user_friends (user_id);
CREATE INDEX idx_user_friends_friend ON user_friends (friend_id);

-- Full-text search on venue name
CREATE INDEX idx_venues_name_trgm ON venues USING GIN (name gin_trgm_ops);
```

### Migration Strategy

- Use a migration tool such as **node-pg-migrate** or **Prisma Migrate**
- Migrations are sequential, timestamped SQL files in `server/migrations/`
- Every migration must be reversible (include `down` function)
- Seed data is separate from schema migrations, stored in `server/seeds/`
- Migration order:
  1. Core tables: users, venues, pulses, reactions
  2. Social tables: user_friends, user_followed_venues
  3. Feature tables: notifications, events, event_rsvps, stories, crews
  4. Engagement tables: achievements, user_achievements, playlists, playlist_pulses
  5. Platform tables: api_keys, webhook_subscriptions, sessions
- CI runs migrations against a test database before merge
- Production migrations run in a transaction where possible; large data migrations use batched updates

### Environment Configuration

| Environment | Database | Notes |
|---|---|---|
| development | Local PostgreSQL + PostGIS | Seeded with mock data from `mock-data.ts` |
| test | Ephemeral PostgreSQL | Created and destroyed per test run |
| staging | Managed PostgreSQL (e.g. RDS) | Seeded with realistic but synthetic data |
| production | Managed PostgreSQL with read replicas | Connection pooling via PgBouncer |

---

## Real-Time Infrastructure

### WebSocket (Primary)

WebSocket connections handle live updates for connected clients.

**Connection flow:**
1. Client connects to `wss://api.pulse.app/ws` with access token as query param or first message
2. Server validates token, associates connection with user ID
3. Client subscribes to channels:
   - `venue:{venueId}` -- live pulse score updates, new pulses
   - `user:{userId}` -- personal notifications, friend activity
   - `crew:{crewId}` -- crew check-in confirmations
4. Server pushes events as JSON messages

**Event types:**

```
{ "type": "venue.score_update", "venueId": "uuid", "score": 87, "velocity": 5.2 }
{ "type": "venue.new_pulse", "venueId": "uuid", "pulse": { ... } }
{ "type": "notification.new", "notification": { ... } }
{ "type": "crew.checkin_update", "crewId": "uuid", "confirmations": { ... } }
{ "type": "presence.update", "venueId": "uuid", "friendsHere": 3 }
```

**Scaling:**
- Use Redis Pub/Sub to fan out events across multiple WebSocket server instances
- Heartbeat every 30 seconds to detect stale connections
- Automatic reconnection with exponential backoff on the client

### Server-Sent Events (Fallback)

For clients that cannot maintain WebSocket connections (older browsers, restrictive firewalls):

- `GET /api/v1/stream?channels=venue:uuid,user:uuid`
- Returns `text/event-stream` with the same event payloads
- Automatic reconnection built into the EventSource API
- Simpler to implement behind load balancers and CDNs

### Push Notifications

For backgrounded or closed apps:

- **Firebase Cloud Messaging (FCM)** for Android and web
- **Apple Push Notification service (APNs)** for iOS
- Server stores device tokens per user session
- Notification types that trigger push: friend_pulse, trending_venue (surge), impact
- Respects user notification_preferences -- suppressed categories are never sent
- Batching: group multiple reactions into a single push with summary text

### Presence

The "Who's Here" feature uses a lightweight presence protocol:

1. When a user checks in, server broadcasts a presence update to the venue channel
2. Presence counts are jittered (rounded to nearest 5+) to prevent tracking
3. Only surfaces if 2 or more friends/familiar faces are present (safety buffer)
4. Presence data expires after 90 minutes (aligned with pulse decay)
5. Users can disable presence globally or suppress at specific venues
