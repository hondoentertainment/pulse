import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  authorizeCronNightCoach,
  cronNightCoachNoopPayload,
  hasCronVapid,
  planNightCoachJob,
} from '../../../src/lib/cron-night-coach'
import type { Pulse, Venue } from '../../../src/lib/types'

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.61, lng: -122.32, address: 'Pike' },
    pulseScore: 0,
    ...overrides,
  }
}

function pulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'u1',
    venueId: 'neumos',
    photos: [],
    energyRating: 'electric',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('authorizeCronNightCoach', () => {
  it('no-ops without CRON_SECRET and never invents one', () => {
    expect(authorizeCronNightCoach({ authorization: 'Bearer x' }, {})).toEqual({
      authorized: false,
      noop: true,
      reason: 'missing_secret',
    })
    expect(cronNightCoachNoopPayload('missing_secret').reason).toBe('missing_secret')
  })

  it('accepts the existing secret via Bearer or x-cron-secret', () => {
    const env = { CRON_SECRET: 'already-there' }
    expect(authorizeCronNightCoach({ authorization: 'Bearer already-there' }, env).authorized).toBe(true)
    expect(authorizeCronNightCoach({ cronSecretHeader: 'already-there' }, env).authorized).toBe(true)
    expect(authorizeCronNightCoach({ authorization: 'Bearer nope' }, env).reason).toBe('unauthorized')
  })

  it('does not treat missing VAPID as a reason to invent keys', () => {
    expect(hasCronVapid({})).toBe(false)
    expect(hasCronVapid({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' })).toBe(true)
  })

  it('wires /api/cron/night-coach in vercel.json without inventing CRON_SECRET', () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }
    expect(vercel.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/api/cron/night-coach', schedule: '0 * * * *' }),
      ]),
    )
    expect(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')).not.toMatch(/CRON_SECRET\s*=/)
  })
})

describe('planNightCoachJob', () => {
  it('plans a live digest at 8pm Pacific when a followed room pulsed', () => {
    const now = new Date('2026-09-14T03:10:00.000Z')
    const plan = planNightCoachJob({
      now,
      venues: [venue()],
      pulses: [pulse({ createdAt: '2026-09-14T01:00:00.000Z' })],
      followedVenueIds: ['neumos'],
    })
    expect(plan.digest?.kind).toBe('live')
    expect(plan.digest?.venues[0]?.id).toBe('neumos')
  })

  it('plans quiet-night only when Surging is empty around 9pm', () => {
    const now = new Date('2026-09-14T04:10:00.000Z')
    const empty = planNightCoachJob({
      now,
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['neumos'],
    })
    expect(empty.quiet?.body).toMatch(/Be the first at Neumos/)
    const busy = planNightCoachJob({
      now,
      venues: [venue()],
      pulses: [pulse({ createdAt: '2026-09-14T03:50:00.000Z' })],
      followedVenueIds: ['neumos'],
    })
    expect(busy.quiet).toBeNull()
  })
})
