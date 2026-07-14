# Secrets & Integrations

This document describes every third-party integration Pulse talks to from
the server, which environment variables feed each integration, and how to
rotate them.

> **Why server-side?** Prior to this migration several of these calls
> (Spotify, Uber, Lyft, reverse geocoding, webhook HMAC signing, API-key
> generation) were executed directly in the browser with keys shipped in
> the client bundle. Anyone who opened DevTools could extract them. The
> Edge Functions in `api/integrations/`, `api/webhooks/`, and `api/keys/`
> now own all secrets; the browser calls a same-origin `/api/*` endpoint
> via `src/lib/api-client.ts`.

---

## Env var reference

All server-only vars live in the hosting platform's secret store
(Vercel Project Settings → Environment Variables). They are **not**
prefixed with `VITE_` — if they were, Vite would inline them into the
client bundle and defeat the whole point.

### Core platform

| Variable | Scope | Used by | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | client + server | Supabase JS client, `api/_lib/auth.ts` | Safe to expose. |
| `VITE_SUPABASE_ANON_KEY` | client + server | Supabase JS client, `api/_lib/auth.ts` | Safe to expose. |
| `SUPABASE_URL` | server only | `api/_lib/auth.ts` (preferred) | Optional server-only override of `VITE_SUPABASE_URL`. |
| `SUPABASE_ANON_KEY` | server only | `api/_lib/auth.ts` (preferred) | Optional server-only override of `VITE_SUPABASE_ANON_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | migrations, privileged writes | **Never** expose. Not used by the Edge Functions in this PR. |
| `SUPABASE_ADMIN_EMAILS` | server only | `api/keys/generate.ts` | Comma-separated allowlist of admin emails. Callers outside this list get `403`. |

### Spotify (`api/integrations/spotify.ts`)

| Variable | Used for |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | Client-credentials token exchange (public catalog search). |
| `SPOTIFY_CLIENT_SECRET` | Client-credentials token exchange. |

User-scoped calls (`op=playlists`) require the browser to additionally
send `X-Spotify-Token: <user-oauth-token>`. That OAuth flow is the
caller's responsibility — the Edge Function does not store user tokens.

### Uber (`api/integrations/uber.ts`)

| Variable | Used for |
| --- | --- |
| `UBER_SERVER_TOKEN` | Server token for `/v1.2/estimates/price` + `/estimates/time`. |

### Lyft (`api/integrations/lyft.ts`)

| Variable | Used for |
| --- | --- |
| `LYFT_CLIENT_ID` | OAuth client credentials for `/oauth/token`. |
| `LYFT_CLIENT_SECRET` | OAuth client credentials. |

### Geocoding (`api/integrations/geocode.ts`)

| Variable | Used for |
| --- | --- |
| `MAPBOX_SERVER_TOKEN` | Reverse geocoding via `api.mapbox.com` (default provider). |
| `GOOGLE_MAPS_SERVER_KEY` | Reverse geocoding via Google Geocoding API (when `?provider=google`). |

`VITE_MAPBOX_TOKEN` (public, URL-restricted) remains separate — it is
fine to expose for map tile rendering because the token is locked to the
app's domain. The *server* token should be a **different** token without
URL restrictions so geocoding can run from Vercel's outbound IPs.

### Places enrich (`api/integrations/places-enrich.ts`)

| Variable | Used for |
| --- | --- |
| `GOOGLE_MAPS_SERVER_KEY` | Google Places "Find Place from Text" + "Place Details" lookups that backfill a venue's phone, website, hours, address, and `place_id`. Same key as the Google geocoding path above — no separate credential needed. |

`POST /api/integrations/places-enrich` is **admin-only** (`app_metadata.role
=== 'admin'`, enforced server-side via a local JWT decode — see
`api/_lib/auth.ts`). Request body:

```json
{ "venue_id": "<uuid>", "dry_run": false, "force": false }
```

- `dry_run: true` previews the resolved Places data without writing to the
  `venues` row — used by the "Preview Places enrich" button in
  `VenueMetadataForm`.
- `force: true` overwrites existing non-null fields; otherwise only
  empty/null columns are backfilled.
- Without a matching request, or when `GOOGLE_MAPS_SERVER_KEY` isn't
  configured, the endpoint returns `404 place_not_found` / `503
  not_configured` respectively — both are non-fatal for the admin UI (it
  surfaces the error via a toast and leaves the row untouched).

Called from two admin surfaces:

- The per-row **Enrich** button on `/admin/venues/completeness`
  (`src/components/venue-admin/VenueCompletenessPage.tsx`) — applies
  directly (`dry_run: false`).
- The **Preview / Apply Places enrich** buttons on
  `/admin/venues/:id/metadata` (`src/components/venue-admin/VenueMetadataForm.tsx`)
  — preview first, then apply.

Both go through the shared client helper `enrichVenueFromPlaces()` in
`src/lib/venue-admin-client.ts`.

### Webhook signing (`api/webhooks/sign.ts`)

| Variable | Used for |
| --- | --- |
| `WEBHOOK_HMAC_SECRET` | Default HMAC-SHA256 signing secret for outbound webhooks. |
| `WEBHOOK_HMAC_SECRET_<ID>` | Optional per-subscription override. `<ID>` is the subscription ID upper-cased with non-alphanumerics replaced by `_`. |

### API keys (`api/keys/generate.ts`)

No dedicated env var for generation (the random bytes come from
`node:crypto`). Access is gated by `SUPABASE_ADMIN_EMAILS`.

---

## Rotation procedure

The same recipe works for every secret; only the upstream dashboard
differs.

1. **Mint the replacement** in the upstream dashboard (Spotify, Uber,
   Lyft, Mapbox, Google Cloud, Supabase). Leave the old secret active.
2. **Add the new value** as a preview-environment variable in Vercel.
   Redeploy the preview branch and smoke-test the affected endpoint
   (see checklist below).
3. **Promote** the new value to production by overwriting the
   production env var and triggering a redeploy. Vercel's atomic
   deployments mean no function instance sees a mixed state.
4. **Revoke** the old secret upstream once the new deploy has been live
   long enough to drain any cached tokens (most of our caches expire in
   < 1 hour — see `cachedAppToken` / `cachedToken` in the Edge Functions).
5. **Record** the rotation date and the rotator in
   `SUPPORT_RUNBOOK.md` under "Secret rotation history".

### Smoke-test checklist per integration

| Integration | Verify |
| --- | --- |
| Spotify | `GET /api/integrations/spotify?op=search&q=daft+punk` returns `{ data: [...] }` with ≥ 1 track. |
| Uber | `POST /api/integrations/uber` with sample coordinates returns non-empty `priceEstimates`. |
| Lyft | `POST /api/integrations/lyft` with sample coordinates returns non-empty `costEstimates`. |
| Geocode (Mapbox) | `GET /api/integrations/geocode?lat=37.77&lng=-122.41` returns a `city` value. |
| Geocode (Google) | Same with `&provider=google`. |
| Places enrich | `POST /api/integrations/places-enrich` (admin-auth) with `{ "venue_id": "<uuid>", "dry_run": true }` returns a `resolved` preview object (phone/website/hours/address may be `null` if Places has no match — that's OK). |
| Webhook sign | `POST /api/webhooks/sign` (admin-auth) returns a 64-char hex `signature`. |
| API key gen | `POST /api/keys/generate` (admin-auth) returns a `pk_<tier>_<hex>` key. |

---

## Which key goes where?

| Key lives in | Never exposed to | Reason |
| --- | --- | --- |
| Vercel env (server only, **no** `VITE_` prefix) | Client bundle | All secrets in the table above. |
| Vercel env (client + server, `VITE_` prefix) | — | Public anon keys, public Mapbox tile token, feature flags. |
| `.env.local` (developer machine) | Git, CI logs | Same layout as Vercel env. Gitignored. |
| Supabase Edge Function secrets | Client bundle | Not currently used; reserved for future DB-side triggers. |

Pulse never commits real values to git. `.env.example` documents the
names but ships with empty placeholders.

---

## Migration path for existing client code

`src/lib/public-api.ts` and `src/lib/integrations.ts` still contain
browser implementations. Do **not** delete them in the same PR as this
migration — callers throughout the app import these modules directly.
Instead:

1. Identify a call site (e.g. a component calling `generateAPIKey` from
   `public-api.ts`).
2. Replace the import with the equivalent helper from
   `src/lib/api-client.ts`.
3. Pass the Supabase access token where required
   (`session?.access_token` from `useSupabaseAuth`).
4. Delete the now-unreferenced helper from the original module in a
   follow-up PR once the last call site is gone.

`src/lib/api-client.ts` intentionally mirrors the shape of the existing
helpers so the swap is mostly mechanical — see that file's JSDoc for
exact request/response contracts.
