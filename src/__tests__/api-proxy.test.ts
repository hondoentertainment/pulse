/**
 * Tests for src/lib/api-proxy.ts
 *
 * These tests exercise the three public proxy client functions:
 *   - reverseGeocode(lat, lng)
 *   - signWebhook(payload, secret?)
 *   - getApiKey(service)
 *
 * All tests mock globalThis.fetch so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reverseGeocode, signWebhook, getApiKey } from '../lib/api-proxy'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fetch Response-alike that resolves to json(). */
function mockResponse(
  body: unknown,
  status = 200
): Response {
  const json = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(json),
  } as unknown as Response
}

/** Replace globalThis.fetch with a vi.fn() and return a handle. */
function mockFetch(response: Response | (() => Promise<Response>)) {
  const fn = vi.fn(
    typeof response === 'function' ? response : () => Promise.resolve(response)
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// reverseGeocode
// ---------------------------------------------------------------------------

describe('reverseGeocode', () => {
  it('returns city and state from a successful proxy response', async () => {
    mockFetch(
      mockResponse({
        data: {
          city: 'Seattle',
          state: 'WA',
          displayName: 'Seattle, King County, Washington, USA',
          address: { city: 'Seattle', state: 'Washington' },
        },
        error: null,
      })
    )

    const promise = reverseGeocode(47.6062, -122.3321)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ city: 'Seattle', state: 'WA' })
  })

  it('calls the correct proxy endpoint with POST and JSON body', async () => {
    const fetchSpy = mockFetch(
      mockResponse({
        data: { city: 'Portland', state: 'OR', displayName: '', address: {} },
        error: null,
      })
    )

    const promise = reverseGeocode(45.5051, -122.6750)
    await vi.runAllTimersAsync()
    await promise

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/geocode/reverse')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ lat: 45.5051, lng: -122.6750 })
  })

  it('falls back to New York, NY on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network offline'))))

    // Spy on console.warn so the test output stays clean
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = reverseGeocode(40.7128, -74.006)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ city: 'New York', state: 'NY' })
    warnSpy.mockRestore()
  })

  it('falls back to New York, NY on a 502 upstream error', async () => {
    mockFetch(
      mockResponse(
        { data: null, error: { code: 'UPSTREAM_ERROR', message: 'Nominatim unavailable' } },
        502
      )
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = reverseGeocode(40.7128, -74.006)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ city: 'New York', state: 'NY' })
    warnSpy.mockRestore()
  })

  it('falls back to New York, NY when the proxy returns a null data field', async () => {
    mockFetch(
      mockResponse({ data: null, error: { code: 'GEOCODE_FAILED', message: 'No result' } })
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = reverseGeocode(0, 0)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ city: 'New York', state: 'NY' })
    warnSpy.mockRestore()
  })

  it('retries on 5xx and eventually falls back', async () => {
    // Always return a 500 so all retries are exhausted
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        mockResponse(
          { data: null, error: { code: 'UPSTREAM_ERROR', message: 'Server error' } },
          500
        )
      )
    )
    vi.stubGlobal('fetch', fetchSpy)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = reverseGeocode(0, 0)
    // Run timers to advance through retry delays
    await vi.runAllTimersAsync()
    const result = await promise

    // Should have tried more than once (initial + retries)
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1)
    expect(result).toEqual({ city: 'New York', state: 'NY' })
    warnSpy.mockRestore()
  })

  it('does NOT retry on a 400 INVALID_PARAMS error', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        mockResponse(
          { data: null, error: { code: 'INVALID_PARAMS', message: 'bad coordinates' } },
          400
        )
      )
    )
    vi.stubGlobal('fetch', fetchSpy)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = reverseGeocode(999, 999) // invalid coords — proxy would 400
    await vi.runAllTimersAsync()
    await promise

    // Must have been called exactly once (no retries for 4xx)
    expect(fetchSpy).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// signWebhook
// ---------------------------------------------------------------------------

describe('signWebhook', () => {
  it('returns the signature string from a successful response', async () => {
    const expectedSig = 'abc123deadbeef'
    mockFetch(
      mockResponse({ data: { signature: expectedSig }, error: null })
    )

    const promise = signWebhook({ event: 'venue.surge', venueId: 'v1' })
    await vi.runAllTimersAsync()
    const sig = await promise

    expect(sig).toBe(expectedSig)
  })

  it('calls POST /api/webhook/sign with the payload in the body', async () => {
    const fetchSpy = mockFetch(
      mockResponse({ data: { signature: 'sig-xyz' }, error: null })
    )

    const payload = { event: 'test', ts: 1234 }
    const promise = signWebhook(payload)
    await vi.runAllTimersAsync()
    await promise

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/webhook/sign')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ payload })
  })

  it('ignores the (deprecated) secret argument and still calls the proxy', async () => {
    const fetchSpy = mockFetch(
      mockResponse({ data: { signature: 'server-sig' }, error: null })
    )

    const promise = signWebhook({ foo: 'bar' }, 'client-secret-should-be-ignored')
    await vi.runAllTimersAsync()
    const sig = await promise

    expect(sig).toBe('server-sig')
    // The body must NOT contain the secret
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(init.body as string).not.toContain('client-secret-should-be-ignored')
  })

  it('throws on a 500 server error after retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          mockResponse(
            { data: null, error: { code: 'UPSTREAM_ERROR', message: 'signing failed' } },
            500
          )
        )
      )
    )

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Attach rejection handler immediately to avoid unhandled-rejection warnings,
    // then advance timers and confirm the rejection is surfaced.
    const rejection = expect(signWebhook({ foo: 'bar' })).rejects.toThrow('signing failed')
    await vi.runAllTimersAsync()
    await rejection
    errSpy.mockRestore()
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const rejection = expect(signWebhook({ foo: 'bar' })).rejects.toThrow('offline')
    await vi.runAllTimersAsync()
    await rejection
    errSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// getApiKey
// ---------------------------------------------------------------------------

describe('getApiKey', () => {
  it('returns the key string from a successful response', async () => {
    mockFetch(
      mockResponse({ data: { key: 'sk_maps_test_1234' }, error: null })
    )

    const promise = getApiKey('maps')
    await vi.runAllTimersAsync()
    const key = await promise

    expect(key).toBe('sk_maps_test_1234')
  })

  it('calls GET /api/keys/:service with the encoded service name', async () => {
    const fetchSpy = mockFetch(
      mockResponse({ data: { key: 'analytics-key' }, error: null })
    )

    const promise = getApiKey('analytics')
    await vi.runAllTimersAsync()
    await promise

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/keys/analytics')
    expect(init.method).toBe('GET')
  })

  it('URL-encodes service names with special characters', async () => {
    const fetchSpy = mockFetch(
      mockResponse({ data: { key: 'special-key' }, error: null })
    )

    const promise = getApiKey('my service/v2')
    await vi.runAllTimersAsync()
    await promise

    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain(encodeURIComponent('my service/v2'))
  })

  it('throws immediately for an empty service name', async () => {
    await expect(getApiKey('')).rejects.toThrow('service name must be a non-empty string')
  })

  it('throws on a 404 NOT_FOUND without retrying', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        mockResponse(
          { data: null, error: { code: 'NOT_FOUND', message: 'Unknown service' } },
          404
        )
      )
    )
    vi.stubGlobal('fetch', fetchSpy)

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const rejection = expect(getApiKey('unknown-service')).rejects.toThrow('Unknown service')
    await vi.runAllTimersAsync()
    await rejection

    // NOT_FOUND is non-retryable so fetch should only be called once
    expect(fetchSpy).toHaveBeenCalledOnce()
    errSpy.mockRestore()
  })

  it('throws on a 500 upstream error after retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          mockResponse(
            { data: null, error: { code: 'UPSTREAM_ERROR', message: 'key store down' } },
            500
          )
        )
      )
    )

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const rejection = expect(getApiKey('maps')).rejects.toThrow('key store down')
    await vi.runAllTimersAsync()
    await rejection
    errSpy.mockRestore()
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('DNS failure'))))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const rejection = expect(getApiKey('maps')).rejects.toThrow('DNS failure')
    await vi.runAllTimersAsync()
    await rejection
    errSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Timeout behaviour (shared across functions)
// ---------------------------------------------------------------------------

describe('request timeout', () => {
  it('reverseGeocode falls back gracefully on AbortError (timeout)', async () => {
    // Simulate a fetch that hangs and then the AbortController fires
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          // Detect the abort signal and reject when it fires
          init.signal?.addEventListener('abort', () => {
            const err = new DOMException('The user aborted a request.', 'AbortError')
            reject(err)
          })
        })
      )
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = reverseGeocode(40.7, -74.0)
    // Advance time past the 5 s timeout (plus retry delays)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ city: 'New York', state: 'NY' })
    warnSpy.mockRestore()
  })
})
