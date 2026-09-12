import { describe, expect, it, beforeEach } from 'vitest'
import {
  FUNNEL_EVENT_NAMES,
  funnelActor,
  stripAnalyticsPii,
  trackFunnel,
} from '../funnel-events'
import {
  REGISTERED_EVENTS,
  setAnalyticsAdapter,
  type TrackedEvent,
} from '../observability/analytics'

describe('funnel events', () => {
  const captured: TrackedEvent[] = []

  beforeEach(() => {
    captured.length = 0
    setAnalyticsAdapter({
      name: 'test',
      track(event) {
        captured.push(event)
      },
    })
  })

  it('registers the exact #92 event names', () => {
    for (const name of FUNNEL_EVENT_NAMES) {
      expect(REGISTERED_EVENTS).toContain(name)
    }
  })

  it('distinguishes guest vs signed-in without PII', () => {
    expect(funnelActor({ hasSession: false, isPlaceholder: false })).toEqual({ guest: true })
    expect(funnelActor({ hasSession: true, isPlaceholder: false })).toEqual({ guest: false })
    expect(stripAnalyticsPii({
      guest: true,
      venueId: 'neumos',
      userId: 'secret-user',
      email: 'a@b.com',
      extra: { phone: '555', venueId: 'neumos' },
    })).toEqual({
      guest: true,
      venueId: 'neumos',
      extra: { venueId: 'neumos' },
    })
  })

  it('fires guest_map_view, venue_open, auth_start, first_pulse_create without userId', () => {
    trackFunnel('guest_map_view', { guest: true, userId: 'should-not-leak' })
    trackFunnel('venue_open', { venueId: 'neumos', guest: true, userId: 'should-not-leak' })
    trackFunnel('auth_start', { guest: true, method: 'google', userId: 'should-not-leak' })
    trackFunnel('first_pulse_create', { venueId: 'neumos', guest: false, userId: 'should-not-leak' })

    expect(captured.map((event) => event.name)).toEqual([
      'guest_map_view',
      'venue_open',
      'auth_start',
      'first_pulse_create',
    ])
    for (const event of captured) {
      expect(event.props).not.toHaveProperty('userId')
      expect(JSON.stringify(event.props)).not.toMatch(/should-not-leak/)
    }
  })
})
