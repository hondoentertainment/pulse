# PRD — Geo-anchored Short Video Feed ("Video Pulses")

Status: Q3 roadmap, feature-flagged (`VITE_VIDEO_FEED_ENABLED`).

## 1. Problem
Pulse's existing pulses are text+photo only. Competitors pair venue discovery
with short-form video (TikTok's "For You", Instagram's Reels, Snap Maps
Spotlight). Users open TikTok to see what a venue is like *right now*; Pulse
should own that moment because our pulses already carry location + energy +
TTL. This surface is a major differentiator vs Yelp, Google Maps, and
Partiful — it converts Pulse's live venue graph into consumable motion.

## 2. User stories
- *As a nightlife explorer* I swipe through a vertical feed of what venues
  within 20 km look like right now, biased toward recency and my location.
- *As a local* I double-tap a Pulse to react (fire), swipe left to open the
  venue profile, tap once to toggle sound.
- *As a creator* I record (or upload) a <=60s clip, add a caption, and my
  video is pinned to the venue for the standard 90-minute TTL.
- *As a safety-conscious user* I can report a video for copyrighted audio,
  NSFW, presence of minors, harassment, spam, or misinformation.
- *As a venue owner* videos pinned to my venue raise its pulse score and
  surface in the "trending now" list on my profile.

## 3. UX

### Capture
- Entry points: bottom-nav "+" FAB on the video tab; venue page "record a
  pulse" CTA.
- Sheet prefers the native camera (Capacitor `Platform.camera` when
  available) and falls back to `<input type="file" accept="video/*"
  capture="environment">` on web.
- Client-side compression (existing `src/lib/video-compression.ts`) targets
  720x1280 / 1.2 Mbps so the typical upload is <=10 MB.
- First-frame thumbnail generated via canvas.
- If duration > 30s, show a trim-start slider (v1 ships single-endpoint
  trim; full timeline editor is a follow-up).
- Caption field runs through server moderation (`checkContent`) on publish.

### Feed
- Full-screen, `snap-y-mandatory` scroller with one pulse per snap target.
- IntersectionObserver plays the currently-visible pulse, pauses all others.
- Muted by default; tap to unmute — choice persists per session only.
- Double-tap to react. Swipe left to open the venue page.
- Adaptive quality: when `navigator.connection.effectiveType` is `2g`/`3g`
  we append `?q=low` to the media URL so the CDN can serve a downscaled
  variant.
- Empty state invites the first creator to post.

## 4. Metrics
- *Engagement*: `pulse_viewed` fires with `feed: 'video'`, `position`;
  dwell-time measured client-side via the `play`/`pause` transitions.
- *Funnel*: capture open -> record -> compress -> upload -> publish;
  instrument each step.
- *Quality*: p50/p95 time-to-first-frame, upload failure rate, moderation
  block rate, report rate per 1k views.
- *Growth*: DAU who viewed at least one video; DAU who published at least
  one video; per-venue video count distribution.

## 5. Abuse mitigation
- **Caption / hashtags**: synchronous server-side screen via
  `api/_lib/moderation.ts#checkContent`.
- **Copyrighted audio**: out-of-band async scanner (follow-up) posts
  takedowns to the moderation queue; user-submitted `copyrighted_audio`
  reports go into the same queue.
- **NSFW**: user report flow + async NSFW-model scoring (follow-up). Until
  then we rely on reports + the `nsfw` report reason for fast human review.
- **Minors in frame**: dedicated `minor_in_frame` report reason so this
  category gets prioritized; content is hidden after the first report on
  this reason pending review.
- **Harassment / spam**: shared report reasons; three reports trigger a
  temporary hide.
- **Rate limits**: 3 publish / hour / user, 10 upload-URL requests / hour,
  3 reports / hour (all enforced in-Edge with `api/_lib/rate-limit.ts`).

## 6. Bandwidth & cost
- Target per-upload size: 8-12 MB (720x1280, 1.2 Mbps, 60s max).
- At 1M MAU, 20% creator ratio, 2 videos/week, 10 MB each => ~1.7 PB/year
  ingress. Egress dominates: average 20 views/video * 10 MB = ~400 TB/day
  if everyone loads full quality; the low-bitrate variant on 2g/3g plus
  90-min TTL brings steady-state storage well under 100 TB.
- Full cost estimate lives in `docs/storage-costs.md`.

## 7. Retention
- Video pulses share the 90-minute TTL with regular pulses: `expires_at =
  created_at + 90 min` (DB default).
- Feed query filters `expires_at > now()`; expired storage objects are
  garbage-collected by a nightly job (follow-up — delete objects older than
  `created_at + 24h` to preserve the object briefly for DMCA disputes).

## 8. Out of scope (v1)
- Adaptive bitrate / HLS — follow-up.
- In-app editor beyond trim-start.
- Creator monetization (tips, branded videos).
- Remix / duet / reply-with-video.
