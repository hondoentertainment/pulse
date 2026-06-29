/**
 * Tests for `api/_lib/push.ts`.
 *
 * Strategy:
 *   - JWT builders are verified cryptographically: we generate real EC/RSA key
 *     pairs with `node:crypto`, sign, and verify the signature + decoded claims.
 *   - `sendPushToUser` is exercised with fully injected env/fetch/transport so
 *     no real network or HTTP/2 connection is opened.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto'
import {
  base64url,
  normalizePem,
  buildApnsJwt,
  buildFcmAssertion,
  sendPushToUser,
  isStalePushToken,
  __resetFcmTokenCache,
  type PushEnv,
} from '../push'

function b64urlToBuffer(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(b64urlToBuffer(segment).toString('utf8'))
}

const ecKeys = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const rsaKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

describe('base64url / normalizePem', () => {
  it('encodes without padding and url-safe alphabet', () => {
    expect(base64url('any carnal pleasure')).toBe('YW55IGNhcm5hbCBwbGVhc3VyZQ')
    expect(base64url('>>>')).not.toContain('/')
    expect(base64url('???')).not.toContain('+')
    expect(base64url('a')).not.toContain('=')
  })

  it('expands escaped newlines in PEM strings', () => {
    expect(normalizePem('-----BEGIN-----\\nLINE\\n-----END-----')).toBe(
      '-----BEGIN-----\nLINE\n-----END-----',
    )
    // Real newlines are left untouched.
    expect(normalizePem('a\nb')).toBe('a\nb')
  })
})

describe('buildApnsJwt (ES256)', () => {
  it('produces a verifiable JWT with correct header + claims', () => {
    const now = 1_700_000_000_000
    const jwt = buildApnsJwt({ keyId: 'KEY123', teamId: 'TEAM45', privateKey: ecKeys.privateKey }, now)

    const [headerSeg, payloadSeg, sigSeg] = jwt.split('.')
    expect(decodeSegment(headerSeg)).toEqual({ alg: 'ES256', kid: 'KEY123', typ: 'JWT' })
    expect(decodeSegment(payloadSeg)).toEqual({ iss: 'TEAM45', iat: Math.floor(now / 1000) })

    const ok = cryptoVerify(
      'SHA256',
      Buffer.from(`${headerSeg}.${payloadSeg}`),
      { key: ecKeys.publicKey, dsaEncoding: 'ieee-p1363' },
      b64urlToBuffer(sigSeg),
    )
    expect(ok).toBe(true)
  })
})

describe('buildFcmAssertion (RS256)', () => {
  it('produces a verifiable assertion for the token endpoint', () => {
    const now = 1_700_000_000_000
    const jwt = buildFcmAssertion(
      { clientEmail: 'svc@project.iam.gserviceaccount.com', privateKey: rsaKeys.privateKey },
      now,
    )

    const [headerSeg, payloadSeg, sigSeg] = jwt.split('.')
    expect(decodeSegment(headerSeg)).toEqual({ alg: 'RS256', typ: 'JWT' })
    const payload = decodeSegment(payloadSeg)
    expect(payload).toMatchObject({
      iss: 'svc@project.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    })

    const ok = cryptoVerify(
      'RSA-SHA256',
      Buffer.from(`${headerSeg}.${payloadSeg}`),
      rsaKeys.publicKey,
      b64urlToBuffer(sigSeg),
    )
    expect(ok).toBe(true)
  })
})

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

const providerEnv: PushEnv = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE: 'service-role-key',
  FCM_PROJECT_ID: 'pulse-proj',
  FCM_CLIENT_EMAIL: 'svc@pulse-proj.iam.gserviceaccount.com',
  FCM_PRIVATE_KEY: rsaKeys.privateKey,
  APNS_KEY_ID: 'KEY123',
  APNS_TEAM_ID: 'TEAM45',
  APNS_PRIVATE_KEY: ecKeys.privateKey,
  APNS_BUNDLE_ID: 'com.pulse.nightlife',
}

/** Routes fetch by URL: token list, oauth2 token, FCM send. */
function makeRoutedFetch(opts: {
  tokens: Array<{ token: string; platform: string }>
  fcmOk?: boolean
}) {
  return vi.fn(async (url: string, init?: { method?: string }) => {
    if (url.includes('/rest/v1/push_tokens')) {
      if (init?.method === 'DELETE') {
        return { ok: true, status: 204, text: async () => '', json: async () => [] }
      }
      return { ok: true, status: 200, text: async () => '', json: async () => opts.tokens }
    }
    if (url.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ access_token: 'fcm-access-token', expires_in: 3600 }),
      }
    }
    if (url.includes('fcm.googleapis.com')) {
      const ok = opts.fcmOk ?? true
      return { ok, status: ok ? 200 : 404, text: async () => 'fcm-error', json: async () => ({}) }
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

describe('isStalePushToken', () => {
  it('detects APNs 410 and FCM UNREGISTERED', () => {
    expect(isStalePushToken('ios', 410, 'BadDeviceToken')).toBe(true)
    expect(isStalePushToken('android', 404, '{"error":"UNREGISTERED"}')).toBe(true)
    expect(isStalePushToken('android', 500, 'server error')).toBe(false)
  })
})

describe('sendPushToUser', () => {
  beforeEach(() => {
    __resetFcmTokenCache()
  })

  it('returns log-only when no provider env is configured', async () => {
    const logger = makeLogger()
    const fetchMock = vi.fn()
    const result = await sendPushToUser(
      { userId: 'u1', title: 'Hi', body: 'there' },
      { env: {}, fetch: fetchMock as never, logger },
    )

    expect(result).toEqual({ userId: 'u1', dispatched: 0, skipped: 0, logOnly: true, errors: [] })
    expect(logger.info).toHaveBeenCalled()
  })

  it('dispatches android via FCM and ios via APNs', async () => {
    const logger = makeLogger()
    const fetchMock = makeRoutedFetch({
      tokens: [
        { token: 'android-tok', platform: 'android' },
        { token: 'ios-tok', platform: 'ios' },
      ],
    })
    const apnsTransport = vi.fn(async () => ({ status: 200, body: '' }))

    const result = await sendPushToUser(
      { userId: 'u1', title: 'Hi', body: 'there', data: { pulseId: 'p1' } },
      { env: providerEnv, fetch: fetchMock as never, apnsTransport, logger, now: () => 1_700_000_000_000 },
    )

    expect(result.dispatched).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.logOnly).toBe(false)
    expect(result.errors).toEqual([])
    expect(apnsTransport).toHaveBeenCalledTimes(1)

    // FCM send body carries the notification + data.
    const fcmCall = fetchMock.mock.calls.find(([u]) => String(u).includes('fcm.googleapis.com'))
    expect(fcmCall).toBeTruthy()
    const body = JSON.parse((fcmCall![1] as { body: string }).body)
    expect(body.message.token).toBe('android-tok')
    expect(body.message.notification).toEqual({ title: 'Hi', body: 'there' })
    expect(body.message.data).toEqual({ pulseId: 'p1' })
  })

  it('records an error when FCM returns non-2xx', async () => {
    const logger = makeLogger()
    const fetchMock = makeRoutedFetch({
      tokens: [{ token: 'android-tok', platform: 'android' }],
      fcmOk: false,
    })

    const result = await sendPushToUser(
      { userId: 'u1', title: 'Hi', body: 'there' },
      { env: providerEnv, fetch: fetchMock as never, logger, now: () => 1_700_000_000_000 },
    )

    expect(result.dispatched).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toContain('FCM 404')
    expect(logger.warn).toHaveBeenCalled()
  })

  it('surfaces APNs non-200 as a skipped error', async () => {
    const logger = makeLogger()
    const fetchMock = makeRoutedFetch({ tokens: [{ token: 'ios-tok', platform: 'ios' }] })
    const apnsTransport = vi.fn(async () => ({ status: 410, body: 'BadDeviceToken' }))

    const result = await sendPushToUser(
      { userId: 'u1', title: 'Hi', body: 'there' },
      { env: providerEnv, fetch: fetchMock as never, apnsTransport, logger, now: () => 1_700_000_000_000 },
    )

    expect(result.dispatched).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toContain('APNS 410')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/push_tokens'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
