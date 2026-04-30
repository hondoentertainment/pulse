/**
 * Tests for the SMS path in `api/_lib/notify.ts`.
 *
 * Covers:
 *   - Happy path: Twilio env present, fetch returns 201 + sid.
 *   - Missing env: at least one of TWILIO_ACCOUNT_SID / TOKEN / FROM unset.
 *   - Twilio error: fetch resolves with response.ok=false.
 *   - Fetch throw: Twilio request rejects.
 *   - Input-validation failures surface structured SUPPRESSED logs.
 *
 * `fetch` is always a `vi.fn()` injected via `deps.fetch` — we never touch the
 * real network.
 */

import { describe, it, expect, vi } from 'vitest'
import { sendSms, type NotifyDeps } from '../notify'

type FetchMock = ReturnType<typeof vi.fn>

function makeFetch(
  resp: Partial<{
    ok: boolean
    status: number
    text: () => Promise<string>
    json: () => Promise<unknown>
  }> | Error,
): FetchMock {
  if (resp instanceof Error) {
    return vi.fn().mockRejectedValue(resp)
  }
  return vi.fn().mockResolvedValue({
    ok: resp.ok ?? true,
    status: resp.status ?? 200,
    text: resp.text ?? (async () => ''),
    json: resp.json ?? (async () => ({})),
  })
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

const fullEnv: NotifyDeps['env'] = {
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'token-test',
  TWILIO_FROM: '+15555550100',
}

describe('sendSms - Twilio path (env present)', () => {
  it('dispatches a POST to Twilio with form-encoded body + Basic auth', async () => {
    const fetchMock = makeFetch({
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM123' }),
    })
    const logger = makeLogger()

    const result = await sendSms(
      { to: '+15555550123', body: 'hello' },
      { env: fullEnv, fetch: fetchMock, logger },
    )

    expect(result).toEqual({
      ok: true,
      provider: 'twilio',
      providerMessageId: 'SM123',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json',
    )
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.headers.Authorization).toMatch(/^Basic /)
    expect(init.body).toContain('To=%2B15555550123')
    expect(init.body).toContain('From=%2B15555550100')
    // STOP footer is appended to the body.
    expect(init.body).toContain('Reply%20STOP%20to%20unsubscribe.')
    // No suppressed-marker warnings on success.
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })
})

describe('sendSms - missing env fallback', () => {
  it.each([
    ['TWILIO_ACCOUNT_SID', { ...fullEnv, TWILIO_ACCOUNT_SID: undefined }],
    ['TWILIO_AUTH_TOKEN', { ...fullEnv, TWILIO_AUTH_TOKEN: undefined }],
    ['TWILIO_FROM', { ...fullEnv, TWILIO_FROM: undefined }],
    ['all', {}],
  ])('falls back to log-only when %s is unset', async (_label, env) => {
    const fetchMock = makeFetch({ ok: true })
    const logger = makeLogger()

    const result = await sendSms(
      { to: '+15555550123', body: 'hello' },
      { env, fetch: fetchMock, logger },
    )

    expect(result).toEqual({ ok: true, provider: 'log-only' })
    // Crucially, fetch was NOT called — no accidental network hit.
    expect(fetchMock).not.toHaveBeenCalled()
    // A structured suppressed log was emitted with the marker.
    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [msg, meta] = logger.warn.mock.calls[0]
    expect(msg).toBe('SAFETY_KIT_SMS_SUPPRESSED')
    expect(meta).toMatchObject({
      marker: 'SAFETY_KIT_SMS_SUPPRESSED',
      reason: 'twilio-env-missing',
    })
    // Phone number is redacted — full digits must not leak.
    expect(meta.to).not.toContain('5555550123')
    expect(meta.to).toMatch(/^\+1\*+23$/)
  })
})

describe('sendSms - Twilio error fallback', () => {
  it('logs SAFETY_KIT_SMS_SUPPRESSED on a non-2xx Twilio response', async () => {
    const fetchMock = makeFetch({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    })
    const logger = makeLogger()

    const result = await sendSms(
      { to: '+15555550123', body: 'hello' },
      { env: fullEnv, fetch: fetchMock, logger },
    )

    expect(result).toEqual({
      ok: false,
      provider: 'twilio',
      error: 'twilio-401',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      'SAFETY_KIT_SMS_SUPPRESSED',
      expect.objectContaining({
        marker: 'SAFETY_KIT_SMS_SUPPRESSED',
        reason: 'twilio-http-401',
        responseBody: 'unauthorized',
      }),
    )
  })

  it('never throws and logs SAFETY_KIT_SMS_SUPPRESSED when fetch rejects', async () => {
    const fetchMock = makeFetch(new Error('network down'))
    const logger = makeLogger()

    // If the implementation ever surfaces an error, this assertion fails.
    const result = await sendSms(
      { to: '+15555550123', body: 'hello' },
      { env: fullEnv, fetch: fetchMock, logger },
    )

    expect(result).toEqual({
      ok: false,
      provider: 'twilio',
      error: 'fetch-failed',
    })
    expect(logger.warn).toHaveBeenCalledWith(
      'SAFETY_KIT_SMS_SUPPRESSED',
      expect.objectContaining({
        marker: 'SAFETY_KIT_SMS_SUPPRESSED',
        reason: 'fetch-failed',
        error: expect.stringContaining('network down'),
      }),
    )
  })
})

describe('sendSms - input validation', () => {
  it('rejects a non-E.164 phone number without calling fetch', async () => {
    const fetchMock = makeFetch({ ok: true })
    const logger = makeLogger()

    const result = await sendSms(
      { to: '555-555-0123', body: 'hello' },
      { env: fullEnv, fetch: fetchMock, logger },
    )

    expect(result).toEqual({
      ok: false,
      provider: 'log-only',
      error: 'invalid-e164',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'SAFETY_KIT_SMS_SUPPRESSED',
      expect.objectContaining({ reason: 'invalid-e164' }),
    )
  })

  it('rejects an over-length body without calling fetch', async () => {
    const fetchMock = makeFetch({ ok: true })
    const logger = makeLogger()

    const result = await sendSms(
      { to: '+15555550123', body: 'x'.repeat(1601) },
      { env: fullEnv, fetch: fetchMock, logger },
    )

    expect(result).toEqual({
      ok: false,
      provider: 'log-only',
      error: 'invalid-body',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'SAFETY_KIT_SMS_SUPPRESSED',
      expect.objectContaining({ reason: 'invalid-body' }),
    )
  })
})
