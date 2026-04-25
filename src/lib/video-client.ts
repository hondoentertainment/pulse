/**
 * Video-feed HTTP client.
 *
 * Wraps the four video Edge Functions behind an `ApiResult<T>` discriminated
 * union so callers can branch on `result.ok` without try/catch and without
 * conflating "network error" with "server rejected the request".
 */

export interface ApiResultOk<T> {
  ok: true
  data: T
}

export interface ApiResultErr {
  ok: false
  error: string
  status?: number
  retryAfterSeconds?: number
}

export type ApiResult<T> = ApiResultOk<T> | ApiResultErr

export interface VideoFeedItem {
  id: string
  userId: string
  venueId: string
  createdAt: string
  expiresAt: string
  caption: string | null
  hashtags: string[]
  videoUrl: string
  videoDurationMs: number
  videoWidth: number
  videoHeight: number
  videoThumbnailUrl: string | null
  videoMimeType: string
  videoBytes: number
  venueLat: number
  venueLng: number
  pulseScore: number
  reactionCount: number
  score?: number
}

export interface VideoFeedPage {
  items: VideoFeedItem[]
  nextCursor: string | null
  hasMore: boolean
}

export interface UploadUrlResponse {
  bucket: string
  path: string
  signedUrl: string
  mime: string
  maxBytes: number
  expiresAt: string
}

export interface PublishVideoPulseInput {
  venueId: string
  caption: string
  hashtags: string[]
  videoStorageKey: string
  durationMs: number
  width: number
  height: number
  thumbnailStorageKey: string | null
  mime: string
  bytes: number
  venueLat: number
  venueLng: number
}

export type VideoReportReason =
  | 'copyrighted_audio'
  | 'nsfw'
  | 'minor_in_frame'
  | 'harassment'
  | 'spam'
  | 'misinformation'
  | 'other'

// --- internal ----------------------------------------------------

type FetchLike = typeof fetch

function getFetch(): FetchLike {
  // `globalThis.fetch` is the canonical source in modern environments; we
  // re-read it every call so tests can stub it via `vi.stubGlobal('fetch', ...)`.
  const f = (globalThis as { fetch?: FetchLike }).fetch
  if (!f) throw new Error('fetch not available')
  return f
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function handle<T>(res: Response): Promise<ApiResult<T>> {
  const body = (await parseJsonSafe(res)) as
    | { data?: T; error?: string; retryAfterSeconds?: number }
    | null

  if (!res.ok) {
    const retryHeader = res.headers.get('retry-after')
    const retryAfterSeconds = retryHeader
      ? Number.parseInt(retryHeader, 10)
      : body?.retryAfterSeconds
    return {
      ok: false,
      status: res.status,
      error: body?.error ?? `HTTP ${res.status}`,
      retryAfterSeconds:
        typeof retryAfterSeconds === 'number' && !Number.isNaN(retryAfterSeconds)
          ? retryAfterSeconds
          : undefined,
    }
  }

  if (!body || typeof body !== 'object' || !('data' in body) || body.data === undefined) {
    return { ok: false, status: res.status, error: 'Malformed response' }
  }
  return { ok: true, data: body.data as T }
}

async function send<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await getFetch()(url, init)
    return await handle<T>(res)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

// --- public API ---------------------------------------------------

export interface VideoClientOptions {
  baseUrl?: string
  authToken?: string | null
}

export function listVideoFeed(
  args: { cursor?: string | null; limit?: number; lat?: number | null; lng?: number | null },
  opts: VideoClientOptions = {},
): Promise<ApiResult<VideoFeedPage>> {
  const base = opts.baseUrl ?? ''
  const qs = new URLSearchParams()
  if (args.cursor) qs.set('cursor', args.cursor)
  if (args.limit) qs.set('limit', String(args.limit))
  if (typeof args.lat === 'number') qs.set('lat', String(args.lat))
  if (typeof args.lng === 'number') qs.set('lng', String(args.lng))
  const url = `${base}/api/video/feed${qs.toString() ? `?${qs.toString()}` : ''}`
  return send<VideoFeedPage>(url, {
    method: 'GET',
    headers: authHeaders(opts.authToken ?? null),
  })
}

export function requestUploadUrl(
  args: { filename: string; mime: string; bytes: number },
  opts: VideoClientOptions = {},
): Promise<ApiResult<UploadUrlResponse>> {
  const base = opts.baseUrl ?? ''
  return send<UploadUrlResponse>(`${base}/api/video/upload-url`, {
    method: 'POST',
    headers: authHeaders(opts.authToken ?? null),
    body: JSON.stringify(args),
  })
}

export async function uploadVideo(
  signedUrl: string,
  blob: Blob,
  mime: string,
): Promise<ApiResult<{ uploaded: true }>> {
  try {
    const res = await getFetch()(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: blob,
    })
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Upload failed (${res.status})` }
    }
    return { ok: true, data: { uploaded: true } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Upload network error',
    }
  }
}

export interface PublishVideoPulseResponse {
  pulse: VideoFeedItem
  moderation: { severity: 'clean' | 'warn' | 'block'; findings: unknown[] }
}

export function publishVideoPulse(
  input: PublishVideoPulseInput,
  opts: VideoClientOptions = {},
): Promise<ApiResult<PublishVideoPulseResponse>> {
  const base = opts.baseUrl ?? ''
  return send<PublishVideoPulseResponse>(`${base}/api/video/publish`, {
    method: 'POST',
    headers: authHeaders(opts.authToken ?? null),
    body: JSON.stringify(input),
  })
}

export function reportVideo(
  args: { pulseId: string; reason: VideoReportReason; note?: string },
  opts: VideoClientOptions = {},
): Promise<ApiResult<{ report: { id: string } }>> {
  const base = opts.baseUrl ?? ''
  return send<{ report: { id: string } }>(`${base}/api/video/report`, {
    method: 'POST',
    headers: authHeaders(opts.authToken ?? null),
    body: JSON.stringify(args),
  })
}
