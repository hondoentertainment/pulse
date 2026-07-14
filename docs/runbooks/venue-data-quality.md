# Runbook: Venue Data Quality

**Owner:** Venue/catalog on-call. **Severity:** Not incident-tier — this is
routine catalog upkeep, not a page-worthy runbook. Use it when onboarding a
new city, cleaning up the Seattle MVP catalog, or triaging user-submitted
data reports.

## 1. Apply the data-quality migrations

Structured fields (`neighborhood`, `category_key`, `price_range`,
`menu_url`, `place_id`, `enriched_at`) and the `venue_data_reports` table
come from:

```
supabase/migrations/20260712000000_venue_data_quality.sql
```

The curated Seattle nightlife seed (mirrors
`src/lib/seattle-nightlife-catalog.ts`) comes from:

```
supabase/migrations/20260713000000_seattle_nightlife_seed.sql
```

Apply via the Supabase CLI (or your usual migration pipeline):

```bash
supabase db push
# or, against a specific project:
supabase db push --db-url "$SUPABASE_DB_URL"
```

Both migrations are **idempotent** — `ADD COLUMN IF NOT EXISTS` and
`INSERT ... ON CONFLICT (id) DO UPDATE` — so re-running them after a catalog
edit in `seattle-nightlife-catalog.ts` is safe and expected. The seed
migration only overwrites curated fields (name, location, neighborhood,
category, phone/website, dress code, cover charge, price range,
indoor/outdoor, hours, maps link) on conflict; it deliberately leaves
`pulse_score`, `place_id`, `enriched_at`, `menu_url`, `capacity_hint`, and
`accessibility_features` alone so live scoring and Places enrichment don't
get clobbered by a re-seed.

## 2. Seed / re-seed the Seattle catalog

If you've hand-edited `src/lib/seattle-nightlife-catalog.ts` (new venue,
corrected hours, etc.), mirror the change into
`20260713000000_seattle_nightlife_seed.sql` (same UUID, same field values)
and re-run the migration. The venue's fixed UUID is
`b0000000-0000-4000-8000-0000000000NN` where `NN` is its 1-indexed position
in the `SEATTLE_NIGHTLIFE_CURATED` array — keep the SQL and TS arrays in the
same order so the mapping stays obvious.

## 3. Enrich venues from Google Places

Requires `GOOGLE_MAPS_SERVER_KEY` (see `docs/secrets-and-integrations.md`).
Two ways to trigger enrichment, both admin-only:

- **Bulk-ish, from the completeness dashboard:** open
  `/admin/venues/completeness`, find a row missing phone/website/hours, and
  click **Enrich**. This calls `POST /api/integrations/places-enrich` with
  `dry_run: false` directly — no confirmation step, so only use it on rows
  you've already eyeballed.
- **Single venue, with a preview:** open `/admin/venues/:id/metadata` and
  use **Preview Places enrich** (dry run, shows what would change) before
  **Apply Places enrich**.

Curl equivalent (useful for scripting a backfill pass):

```bash
curl -X POST "$APP_URL/api/integrations/places-enrich" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"venue_id":"<uuid>","dry_run":true}'
```

Drop `dry_run` (or set it `false`) once the preview looks right.

## 4. Review user-submitted data reports

Users flag catalog issues ("hours are wrong", "no menu listed", etc.) via
the data-gap sheet on the venue page (`src/components/VenueDataGapSheet.tsx`),
which lands in the `venue_data_reports` table.

Open `/admin/venues/data-reports` to triage the **Pending** queue:

- **Mark actioned** — you fixed the underlying venue data (usually via the
  metadata editor or a Places enrich). Do this first, then action the
  report.
- **Mark reviewed** — you looked at it and it's informational / low-value
  but not wrong enough to fix immediately.
- **Dismiss** — duplicate, spam, or not actionable.

The queue also links directly to each flagged venue's metadata editor via
**Edit venue**. Status changes stamp `reviewed_at` / `reviewed_by` (the
reviewing admin's user id) server-side.

API equivalent for scripting bulk triage:

```bash
# List pending reports
curl "$APP_URL/api/admin/venue-data-reports?status=pending&limit=200" \
  -H "Authorization: Bearer $ADMIN_JWT"

# Mark one actioned
curl -X PATCH "$APP_URL/api/admin/venue-data-reports" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"id":"<report-uuid>","status":"actioned"}'
```

## 5. Check for duplicate catalog entries

Open `/admin/venues/duplicates` (backed by `GET /api/admin/venue-duplicates`
→ `src/lib/venue-dedupe.ts`). It groups venues that either:

- Normalize to the **same name** (case/diacritics/punctuation-insensitive,
  strips leading "the/a/an"), or
- Are within **~100m** of each other **and** have similar names (substring
  match or Levenshtein distance ≤ 25% of the longer name).

For each group, open the older/lower-quality row's metadata editor, migrate
any unique data (phone, hours, cover charge) into the row you're keeping,
then soft-delete the duplicate (`deleted_at`) via your usual Supabase
console/SQL — there's no delete button in the admin UI yet, by design
(avoids an accidental one-click mass-delete surface).

## 6. Completeness dashboard

`/admin/venues/completeness` (backed by `GET /api/admin/venues-completeness`
→ `src/lib/venue-completeness.ts` / `api/_lib/venue-completeness.ts`) ranks
venues worst-first by a weighted completeness score across address,
coordinates, category, hours, phone, website, dress code, cover charge,
accessibility, neighborhood, price range, and maps link. Use it as your
starting point for both the Enrich workflow (step 3) and manual metadata
edits (dress code, cover charge, accessibility, indoor/outdoor,
capacity hint).

## Quick reference — admin URLs

| Page | Path | Backing API |
| --- | --- | --- |
| Completeness dashboard | `/admin/venues/completeness` | `GET /api/admin/venues-completeness` |
| Venue metadata editor | `/admin/venues/:id/metadata` | `POST /api/admin/venue-metadata`, `POST /api/integrations/places-enrich` |
| Data reports queue | `/admin/venues/data-reports` | `GET`/`PATCH /api/admin/venue-data-reports` |
| Duplicate detection | `/admin/venues/duplicates` | `GET /api/admin/venue-duplicates` |
| Signal admin | `/admin/signal` | see `SignalAdminPage` |

All five are admin-gated by `app_metadata.role === 'admin'`, both
client-side (403 UI) and server-side (403 JSON from the API). Reachable
from the Profile tab → **Venue Data Quality** link, or directly by URL.
