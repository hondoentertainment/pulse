import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listVideoFeed,
  publishVideoPulse,
  reportVideo,
  requestUploadUrl,
  uploadVideo,
} from '@/lib/video-client'

type MockResponseInit = {
  ok: boolean
  status?: number
  headers?: Record<string, string>
  body?: unknown
}

function makeResponse(init: MockResponseInit): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 400),
    headers: {
      get: (key: string) => init.headers?.[key.toLowerCase()] ?? null,
    } as unknown as Headers,
    json: async () => init.body,
  } as unknown as Response
}

describe('video-client', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listVideoFeed', () => {
    it('GETs /api/video/feed and returns ok=true on success', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({
          ok: true,
          body: { data: { items: [], nextCursor: null, hasMore: false } },
        }),
      )

      const result = await listVideoFeed({ limit: 5 })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.items).toEqual([])
      }

      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toContain('/api/video/feed')
      expect(String(url)).toContain('limit=5')
      expect(init.method).toBe('GET')
    })

    it('includes lat/lng/cursor in query string', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ ok: true, body: { data: { items: [], nextCursor: null, hasMore: false } } }),
      )
      await listVideoFeed({ limit: 3, cursor: 'abc', lat: 37.7, lng: -122.4 })
      const [url] = fetchSpy.mock.calls[0]
      const s = String(url)
      expect(s).toContain('cursor=abc')
      expect(s).toContain('lat=37.7')
      expect(s).toContain('lng=-122.4')
    })

    it('maps non-ok responses to ApiResult.err with status', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ ok: false, status: 503, body: { error: 'down' } }),
      )
      const result = await listVideoFeed({})
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(503)
        expect(result.error).toBe('down')
      }
    })

    it('maps network errors to ApiResult.err without status', async () => {
      fetchSpy.mockRejectedValue(new Error('offline'))
      const result = await listVideoFeed({})
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBeUndefined()
        expect(result.error).toBe('offline')
      }
    })
  })

  describe('requestUploadUrl', () => {
    it('POSTs JSON body with auth header', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 201,
          body: {
            data: {
              bucket: 'pulse-videos',
              path: 'u1/x.mp4',
              signedUrl: 'https://s/x',
              mime: 'video/mp4',
              maxBytes: 52428800,
              expiresAt: '2030-01-01',
            },
          },
        }),
      )

      const res = await requestUploadUrl(
        { filename: 'x.mp4', mime: 'video/mp4', bytes: 1024 },
        { authToken: 'tok' },
      )
      expect(res.ok).toBe(true)

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe('Bearer tok')
      expect(JSON.parse(init.body)).toEqual({
        filename: 'x.mp4',
        mime: 'video/mp4',
        bytes: 1024,
      })
    })
  })

  describe('uploadVideo', () => {
    it('PUTs the blob to the signed URL', async () => {
      fetchSpy.mockResolvedValue(makeResponse({ ok: true, status: 200, body: null }))
      const blob = new Blob(['x'], { type: 'video/webm' })
      const res = await uploadVideo('https://signed/', blob, 'video/webm')
      expect(res.ok).toBe(true)
      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toBe('https://signed/')
      expect(init.method).toBe('PUT')
      expect(init.headers['Content-Type']).toBe('video/webm')
    })

    it('returns err on non-2xx', async () => {
      fetchSpy.mockResolvedValue(makeResponse({ ok: false, status: 403, body: null }))
      const blob = new Blob(['x'], { type: 'video/webm' })
      const res = await uploadVideo('https://signed/', blob, 'video/webm')
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.status).toBe(403)
    })
  })

  describe('publishVideoPulse', () => {
    it('POSTs publish payload and returns the server response', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 201,
          body: {
            data: {
              pulse: { id: 'p1' },
              moderation: { severity: 'clean', findings: [] },
            },
          },
        }),
      )
      const res = await publishVideoPulse({
        venueId: 'v1',
        caption: 'hi',
        hashtags: [],
        videoStorageKey: 'u/x.mp4',
        durationMs: 5_000,
        width: 720,
        height: 1280,
        thumbnailStorageKey: null,
        mime: 'video/mp4',
        bytes: 1234,
        venueLat: 40,
        venueLng: -74,
      })
      expect(res.ok).toBe(true)
    })
  })

  describe('reportVideo', () => {
    it('POSTs report payload', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ ok: true, status: 201, body: { data: { report: { id: 'r1' } } } }),
      )
      const res = await reportVideo({ pulseId: 'p1', reason: 'nsfw' })
      expect(res.ok).toBe(true)
      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toContain('/api/video/report')
      expect(JSON.parse(init.body)).toEqual({ pulseId: 'p1', reason: 'nsfw' })
    })

    it('propagates 429 with retry-after', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({
          ok: false,
          status: 429,
          headers: { 'retry-after': '60' },
          body: { error: 'rate limited' },
        }),
      )
      const res = await reportVideo({ pulseId: 'p1', reason: 'spam' })
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.status).toBe(429)
        expect(res.retryAfterSeconds).toBe(60)
      }
    })
  })
})
