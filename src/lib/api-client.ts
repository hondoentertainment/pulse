/**
 * Thin browser client for the server-side Edge Functions in `api/`.
 *
 * This file is ADDITIVE — it runs alongside the existing integration
 * helpers in src/lib/integrations.ts and src/lib/public-api.ts. Callers
 * can migrate incrementally by swapping a single call site at a time.
 *
 * All requests:
 *   - hit same-origin /api/* (no CORS headaches in prod)
 *   - auto-forward the Supabase access token if the caller provides one
 *   - return discriminated `{ ok: true, data } | { ok: false, error }`
 *     so call sites don't need try/catch boilerplate.
 */

import type { NotificationSettings } from '@/lib/notification-settings'

export type ApiSuccess<T> = { ok: true; data: T }
export type ApiFailure = { ok: false; status: number; error: string }
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export interface ApiClientOptions {
  /** Supabase access token (JWT). Forwarded as `Authorization: Bearer ...`. */
  accessToken?: string | null
  /** Spotify user-token (used only by `spotifyUserPlaylists`). */
  spotifyUserToken?: string | null
  /** Optional AbortSignal so callers can cancel in-flight requests. */
  signal?: AbortSignal
  /** Override the base URL (mostly for tests). Defaults to same-origin. */
  baseUrl?: string
}

function buildHeaders(
  opts: ApiClientOptions | undefined,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts?.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`
  if (opts?.spotifyUserToken) headers['X-Spotify-Token'] = opts.spotifyUserToken
  if (extra) Object.assign(headers, extra)
  return headers
}

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // body may be empty; fall through
  }
  if (!response.ok) {
    const error =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : null) ?? `Request failed (${response.status})`
    return { ok: false, status: response.status, error }
  }
  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? ((payload as { data: T }).data)
      : (payload as T)
  return { ok: true, data }
}

function endpoint(path: string, opts?: ApiClientOptions): string {
  const base = opts?.baseUrl ?? ''
  return `${base}${path}`
}

// ── Venue catalog (Edge, JWT + RLS) ──────────────────────────────────────

export interface VenueListApiPayload {
  venues: unknown[]
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * GET /api/venues/list — authenticated venue page (same-origin).
 * Returns `ApiResult<VenueListApiPayload>`; rows match Postgrest `venues` shape.
 */
export async function fetchVenueListPage(
  opts: ApiClientOptions & { limit?: number; offset?: number } = {},
): Promise<ApiResult<VenueListApiPayload>> {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const url = new URL(endpoint('/api/venues/list', opts), typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  const res = await fetch(`${url.pathname}${url.search}`, {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts.signal,
  })
  return parse<VenueListApiPayload>(res)
}

export interface PulseListApiPayload {
  pulses: unknown[]
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * GET /api/pulses/list — authenticated live or venue-scoped pulse page.
 * When `venueId` is set, returns recent pulses for that venue (not limited by expiry).
 * Otherwise returns non-expired pulses only.
 */
export async function fetchPulseListPage(
  opts: ApiClientOptions & {
    limit?: number
    offset?: number
    venueId?: string
  } = {},
): Promise<ApiResult<PulseListApiPayload>> {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const url = new URL(endpoint('/api/pulses/list', opts), typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  if (opts.venueId) url.searchParams.set('venueId', opts.venueId)
  const res = await fetch(`${url.pathname}${url.search}`, {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts.signal,
  })
  return parse<PulseListApiPayload>(res)
}

export interface PulseDetailApiPayload {
  pulse: unknown
}

/**
 * GET /api/pulses/get — authenticated pulse detail by id.
 */
export async function fetchPulseDetail(
  pulseId: string,
  opts: ApiClientOptions = {},
): Promise<ApiResult<PulseDetailApiPayload>> {
  const url = new URL(endpoint('/api/pulses/get', opts), typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  url.searchParams.set('id', pulseId)
  const res = await fetch(`${url.pathname}${url.search}`, {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts.signal,
  })
  return parse<PulseDetailApiPayload>(res)
}

// ── Spotify ───────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string
  name: string
  artist: string
  album: string | null
  artworkUrl: string | null
  spotifyUrl: string | null
}

export interface SpotifyPlaylist {
  id: string
  name: string
  isPublic: boolean
  trackCount: number
  spotifyUrl: string | null
}

export async function searchSpotifyTracks(
  query: string,
  limit = 10,
  opts?: ApiClientOptions
): Promise<ApiResult<SpotifyTrack[]>> {
  const url = new URL(endpoint('/api/integrations/spotify', opts), window.location.origin)
  url.searchParams.set('op', 'search')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.pathname + url.search, {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts?.signal,
  })
  return parse<SpotifyTrack[]>(res)
}

export async function getSpotifyUserPlaylists(
  opts: ApiClientOptions
): Promise<ApiResult<SpotifyPlaylist[]>> {
  const url = new URL(endpoint('/api/integrations/spotify', opts), window.location.origin)
  url.searchParams.set('op', 'playlists')
  const res = await fetch(url.pathname + url.search, {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts?.signal,
  })
  return parse<SpotifyPlaylist[]>(res)
}

// ── Rideshare ─────────────────────────────────────────────────────

export interface RideEstimateRequest {
  pickup: { lat: number; lng: number }
  dropoff: { lat: number; lng: number }
  seatCount?: number
}

export interface UberEstimates {
  priceEstimates: unknown
  timeEstimates: unknown
}

export async function getUberEstimates(
  req: RideEstimateRequest,
  opts?: ApiClientOptions
): Promise<ApiResult<UberEstimates>> {
  const res = await fetch(endpoint('/api/integrations/uber', opts), {
    method: 'POST',
    headers: buildHeaders(opts),
    body: JSON.stringify(req),
    signal: opts?.signal,
  })
  return parse<UberEstimates>(res)
}

export interface LyftEstimates {
  costEstimates: unknown
  etaEstimates: unknown
}

export async function getLyftEstimates(
  req: Omit<RideEstimateRequest, 'seatCount'>,
  opts?: ApiClientOptions
): Promise<ApiResult<LyftEstimates>> {
  const res = await fetch(endpoint('/api/integrations/lyft', opts), {
    method: 'POST',
    headers: buildHeaders(opts),
    body: JSON.stringify(req),
    signal: opts?.signal,
  })
  return parse<LyftEstimates>(res)
}

// ── Reverse geocoding ─────────────────────────────────────────────

export interface ReverseGeocodeResult {
  address: string | null
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
  provider: 'mapbox' | 'google'
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  provider: 'mapbox' | 'google' = 'mapbox',
  opts?: ApiClientOptions
): Promise<ApiResult<ReverseGeocodeResult>> {
  const url = new URL(endpoint('/api/integrations/geocode', opts), window.location.origin)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lng', String(lng))
  url.searchParams.set('provider', provider)
  const res = await fetch(url.pathname + url.search, {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts?.signal,
  })
  return parse<ReverseGeocodeResult>(res)
}

// ── Webhook signing ───────────────────────────────────────────────

export interface SignedWebhookPayload {
  event: string
  timestamp: number
  data: Record<string, unknown>
  signature: string
}

export async function signWebhookPayload(
  event: string,
  data: Record<string, unknown>,
  opts: ApiClientOptions & { subscriptionId?: string }
): Promise<ApiResult<SignedWebhookPayload>> {
  const res = await fetch(endpoint('/api/webhooks/sign', opts), {
    method: 'POST',
    headers: buildHeaders(opts),
    body: JSON.stringify({
      event,
      data,
      subscriptionId: opts.subscriptionId,
    }),
    signal: opts.signal,
  })
  return parse<SignedWebhookPayload>(res)
}

// ── API key generation ────────────────────────────────────────────

export type ApiKeyTier = 'free' | 'starter' | 'business' | 'enterprise'

export interface GeneratedApiKey {
  id: string
  key: string
  name: string
  ownerId: string
  tier: ApiKeyTier
  createdAt: string
  active: boolean
  rateLimit: number
  dailyRequests: number
  dailyLimit: number
  issuedBy: string
}

export async function generateApiKey(
  name: string,
  ownerId: string,
  tier: ApiKeyTier = 'free',
  opts: ApiClientOptions = {}
): Promise<ApiResult<GeneratedApiKey>> {
  const res = await fetch(endpoint('/api/keys/generate', opts), {
    method: 'POST',
    headers: buildHeaders(opts),
    body: JSON.stringify({ name, ownerId, tier }),
    signal: opts.signal,
  })
  return parse<GeneratedApiKey>(res)
}

// ── Notification settings ─────────────────────────────────────────

export async function fetchNotificationSettings(
  opts: ApiClientOptions = {},
): Promise<ApiResult<NotificationSettings>> {
  const res = await fetch(endpoint('/api/account/notification-settings', opts), {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts.signal,
  })
  return parse<NotificationSettings>(res)
}

export async function patchNotificationSettings(
  patch: Partial<NotificationSettings>,
  opts: ApiClientOptions = {},
): Promise<ApiResult<NotificationSettings>> {
  const res = await fetch(endpoint('/api/account/notification-settings', opts), {
    method: 'PATCH',
    headers: buildHeaders(opts),
    body: JSON.stringify(patch),
    signal: opts.signal,
  })
  return parse<NotificationSettings>(res)
}
