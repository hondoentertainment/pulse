# Vibe Vision — Assess Location Energy From a Photo

Agents (and the Create Pulse UI) can read a venue's live vibe from a single photo and map it onto Pulse's energy ratings: `dead` → `chill` → `buzzing` → `electric`.

## Architecture

```
CreatePulseDialog / Concierge
        │
        ├─ POST /api/photos/upload-url  →  PUT signed URL (pulse-videos)
        │
        ▼
 POST /api/vibe/assess  ──or──  tool: assess_venue_photo
   (imageUrl | storageKey | imageBase64)
        │
        ▼
 api/_lib/vibe-vision.ts  →  Anthropic Messages (vision)
        │
        ▼
 { energyRating, confidence, summary, tags, … }
```

| Area | Path |
|------|------|
| Edge API | `api/vibe/assess.ts` |
| Photo upload | `api/photos/upload-url.ts` |
| Vision lib | `api/_lib/vibe-vision.ts` |
| Storage URL | `api/_lib/storage-public-url.ts` |
| Photo client | `src/lib/photo-client.ts` |
| Assess client | `src/lib/vibe-assess-client.ts` |
| Create-pulse flow | `src/lib/vibe-photo-flow.ts` |
| Concierge tool | `assess_venue_photo` in `api/_lib/concierge-{prompts,tools}.ts` |
| UI | `CreatePulseDialog` — Add photo / Assess vibe from photo |
| Flag | `VITE_VIBE_VISION_ENABLED` |

## Enablement

1. Set server `ANTHROPIC_API_KEY`.
2. Optional: `VIBE_VISION_MODEL` (default `claude-sonnet-4-6`).
3. Client flag: `VITE_VIBE_VISION_ENABLED=1`.
4. Supabase Storage bucket `pulse-videos` with owner-folder write RLS (same as video).

Off by default for Seattle launch until the key and cost budget are ready.

## Photo upload

`POST /api/photos/upload-url` (JWT, 30/hour/user)

```json
{ "filename": "scene.jpg", "mime": "image/jpeg", "bytes": 240000 }
```

Returns `{ bucket, path, signedUrl, publicUrl, mime, maxBytes, expiresAt }`.
Client PUTs the blob to `signedUrl`, then stores `path` on the pulse (`photos[]`).

## Assess API

`POST /api/vibe/assess` (JWT, 20/hour/user) — exactly one of:

```json
{ "storageKey": "userId/photos/…", "venueName": "Canon" }
```

```json
{ "imageUrl": "https://…", "venueName": "Canon" }
```

```json
{ "imageBase64": "data:image/jpeg;base64,…", "venueName": "Canon" }
```

Response `data`:

```json
{
  "energyRating": "buzzing",
  "confidence": 0.84,
  "summary": "Standing-room crowd at the bar, lively but not packed.",
  "tags": ["packed-bar", "craft-cocktails"],
  "crowdDensity": "moderate",
  "lighting": "dim",
  "suggestedCaption": "Good mid-evening energy — bar is lively"
}
```

## Concierge tool

`assess_venue_photo` accepts `imageUrl` or `storageKey`. The Night Concierge summarizes the energy rating before recommending that stop.

## Create Pulse UX

1. **Add photo** — camera/gallery → signed upload → preview (works without vibeVision).
2. **Assess vibe from photo** (flag on) — upload, then vision assess; prefills energy, caption, and hashtag chips from tags.
3. Submit sends `photos: [storageKey]` when upload succeeded.

## Product notes

- Assessment **suggests** energy; the user still posts the pulse with their chosen rating.
- Vision output does **not** write directly to venue `pulse_score` (scores stay pulse-derived).
- Oversized local data URLs are not persisted on the pulse (API item length cap 2048) — upload is required for durable photos.
