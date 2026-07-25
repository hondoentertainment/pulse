# Vibe Vision — Assess Location Energy From a Photo

Agents (and the Create Pulse UI) can read a venue's live vibe from a single photo and map it onto Pulse's energy ratings: `dead` → `chill` → `buzzing` → `electric`.

## Architecture

```
CreatePulseDialog / Concierge / Admin batch
        │
        ├─ compressImageDataUrl (client)
        ├─ POST /api/photos/upload-url  →  PUT signed URL (pulse-videos)
        │
        ▼
 POST /api/vibe/assess
   rate limit + daily ¢ cap + safety screen + telemetry
        │
        ▼
 api/_lib/vibe-vision.ts  →  Anthropic Messages (vision)
        │
        ▼
 { energyRating, confidence, safe, tags, applyEnergy, … }
```

| Area | Path |
|------|------|
| Edge API | `api/vibe/assess.ts` |
| Photo upload | `api/photos/upload-url.ts` |
| Admin / telemetry | `api/admin/vibe-vision.ts` |
| Vision lib | `api/_lib/vibe-vision.ts` |
| Cost / events | `api/_lib/vibe-assess-cost.ts` |
| Migration | `supabase/migrations/20260725000000_vibe_vision_storage_and_usage.sql` |
| Image compress | `src/lib/image-compress.ts` |
| Create-pulse flow | `src/lib/vibe-photo-flow.ts` |
| Concierge attach | `ConciergeChatSheet` |
| Admin card | `VibeVisionAdminCard` on `/admin/signal` |
| Flag | `VITE_VIBE_VISION_ENABLED` |
| Smoke | `npm run smoke:vibe-vision -- <base-url>` |

## Enablement

1. Apply migration `20260725000000` (image MIME allowlist + `vibe_assess_*` tables).
2. Set server `ANTHROPIC_API_KEY`.
3. Optional: `VIBE_VISION_MODEL`, `VIBE_VISION_DAILY_CENTS_CAP` (default **50¢**/user/UTC day).
4. Client: `VITE_VIBE_VISION_ENABLED=1`.

## Product behavior

| Behavior | Detail |
|----------|--------|
| Upload | Camera/gallery → JPEG downscale (≤1280px) → signed upload under `{userId}/photos/` |
| Confidence gate | Auto-apply energy only when `confidence ≥ 0.4` (`applyEnergy`) |
| Override | **Keep my rating** / **Use AI rating** / **Re-scan vibe** |
| Safety | Model returns `safe` + `blockedReason`; unsafe → **422** `content_blocked` |
| Cost | Hourly token bucket (20) + daily cents cap → **402** `cap_reached` |
| Concierge | Attach photo → message includes `storageKey` for `assess_venue_photo` |
| Admin | 24h telemetry + batch URL assess for scout QA |

## Staging smoke

```bash
npm run smoke:vibe-vision -- https://your-preview.vercel.app
VIBE_SMOKE_TOKEN=<jwt> npm run smoke:vibe-vision -- https://your-preview.vercel.app
```

Then complete the manual checklist printed by the script (Create Pulse upload, assess, override, concierge attach, admin card).

## API sketch

`POST /api/vibe/assess` — JWT; body exactly one of `imageUrl` | `storageKey` | `imageBase64`.

Success includes `applyEnergy`, `confidenceThreshold`, `costCents`, and `spend`.

`GET/POST /api/admin/vibe-vision` — admin telemetry + batch assess.
