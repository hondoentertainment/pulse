# Video Feed — Architecture

## Surface area
```
/video               # full-screen vertical feed (route-lazy)
POST /api/video/upload-url   # signed PUT URL, 5-min TTL
POST /api/video/publish      # creates a pulse row (rate-limited 3/hr)
GET  /api/video/feed         # paginated, scored feed (30s CDN cache)
POST /api/video/report       # triages into video_reports
```

## Data model
Video pulses are regular `pulses` rows with `video_url IS NOT NULL` plus
the new columns from `20260417000010_video_pulses.sql`:

| column | purpose |
| --- | --- |
| `video_url` | public URL of the encoded video |
| `video_duration_ms` | used for trim/feed UX |
| `video_width`, `video_height` | aspect-ratio gating in the player |
| `video_thumbnail_url` | first-frame poster |
| `video_mime_type` | `video/mp4 \| video/webm \| video/quicktime` |
| `video_bytes` | CDN cost accounting + size cap enforcement |

A partial index `idx_pulses_video_feed` over `created_at DESC WHERE
video_url IS NOT NULL AND deleted_at IS NULL AND expires_at > now()`
supports the feed query with a tight hot set.

## Scoring
`api/_lib/video-feed-scoring.ts` exports a pure `rankCandidates` function:

```
score = 0.45 * recency + 0.25 * pulseScore + 0.15 * engagement + 0.15 * proximity
```

- **recency**: `exp(-ln2 * age_min / 45)` — 45 min half-life.
- **pulseScore**: `venues.pulse_score / 100` (from the existing engine).
- **engagement**: `log10(reactionCount + 1) / log10(50)`, clamped to 1.
- **proximity**: linear, max 20 km. Omitted if no viewer coords.

The weights are intentionally biased toward recency because video pulses
live for 90 minutes — yesterday's top video shouldn't dominate today.

## Bandwidth / quality policy
- Client-side compression targets 720x1280 @ 1.2 Mbps.
- `navigator.connection.effectiveType = 2g|3g` triggers a `?q=low` query
  parameter on the video URL. The CDN layer (Supabase Storage + CDN) is
  expected to serve a 480p variant at that param; until that's wired up
  the param is benign.
- HLS adaptive bitrate is a follow-up; v1 ships a single MP4/WebM.

## Moderation flow
1. **Publish time**: caption + hashtags pass through `checkContent` in
   `api/_lib/moderation.ts`; `block`-severity findings return 422.
2. **Post-publish async**: NSFW + copyrighted-audio scanners (follow-up)
   drop rows into `video_reports` with the respective reasons.
3. **User reports**: `POST /api/video/report` inserts into `video_reports`
   with rate limit 3/hour/reporter.
4. **Moderator queue**: moderators read unresolved rows; when a report is
   actioned we set `resolved_at` and `action_taken`. The existing
   `ModerationQueuePage` is the UI home for the review queue (follow-up:
   dedicated video-report view with inline playback).

## Legal
- **Copyrighted audio**: v1 relies on takedown notices and user reports.
  Once our async music-fingerprint scanner lands (follow-up), audio is
  flagged automatically and the `action_taken = content_removed` path
  deletes the storage object within 24h.
- **DMCA**: storage objects retain for 24h after `expires_at` so a
  disputed video can be exported on request.
- **Minors in frame**: `minor_in_frame` is a first-class report reason.
  A single report under this reason hides the pulse pending human review.
- **Data retention**: pulse row hard-deleted on TTL expiry (nightly job);
  storage object retained 24h then purged.

## Offline queue
`src/lib/video-offline-queue.ts` follows the same shape as `offline-queue`
but holds `VideoPublishJob` entries. When a publish fails with
`navigator.onLine === false` the `VideoCaptureSheet` enqueues a job and
marks the sheet as "done"; the drainer (follow-up) calls
`processVideoQueue(submit)` when connectivity returns.

Note: the video *bytes* are not held by localStorage (that would blow
quota). The queue only persists the metadata; the user keeps a local
object URL for UI preview. A full offline-first upload pipeline requires
IndexedDB blob storage — tracked as a follow-up.

## Feature flag
`VITE_VIDEO_FEED_ENABLED=0` by default. With the flag off:
- BottomNav hides the video tab.
- `VideoFeedRoute` renders a blank sentinel so the route is a no-op.
- The `VideoFeed` chunk is never imported, so the index bundle is
  unaffected.
