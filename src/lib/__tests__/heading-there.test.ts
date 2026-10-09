import { describe, expect, it } from 'vitest'
import {
  absoluteHopLink,
  buildHeadingRecord,
  buildHopOgCopy,
  headingBannerCopy,
  headingButtonLabel,
  headingWriteAction,
  hopLandingPath,
  hopSharePreviewUrl,
  hopTextInviteHref,
  isHeadingActive,
  isHopArrival,
  pickActiveHeading,
} from '../heading-there'

describe('hop links', () => {
  it('uses the short /venue/:id?hop=1 path and the existing share route', () => {
    expect(isHopArrival('?hop=1')).toBe(true)
    expect(isHopArrival('?from=share')).toBe(false)
    expect(hopLandingPath('sf-chapel')).toBe('/venue/sf-chapel?hop=1')
    expect(absoluteHopLink('sf-chapel', 'https://pulse-chi-nine.vercel.app')).toBe(
      'https://pulse-chi-nine.vercel.app/venue/sf-chapel?hop=1',
    )
    expect(hopSharePreviewUrl('sf-chapel', 'https://pulse-chi-nine.vercel.app')).toBe(
      'https://pulse-chi-nine.vercel.app/api/share/venue?venueId=sf-chapel&hop=1',
    )
  })

  it('sends guests to /auth and lets a signed-in user save', () => {
    expect(headingWriteAction({ isPlaceholder: false, hasSession: false }).type).toBe('auth')
    expect(headingWriteAction({ isPlaceholder: false, hasSession: false })).toEqual({
      type: 'auth',
      path: '/auth',
    })
    expect(headingWriteAction({ isPlaceholder: false, hasSession: true })).toEqual({ type: 'save' })
    expect(headingWriteAction({ isPlaceholder: true, hasSession: false })).toEqual({ type: 'save' })
  })

  it('shows the latest active heading and ignores cancelled or stale rows', () => {
    const now = Date.parse('2026-10-10T03:00:00.000Z')
    const fresh = buildHeadingRecord({
      userId: 'u1',
      venueId: 'sf-chapel',
      displayName: 'Kyle',
      now: new Date(now - 5 * 60 * 1000),
    })
    const cancelled = { ...fresh, userId: 'u2', displayName: 'Ada', cancelledAt: new Date(now).toISOString() }
    const stale = buildHeadingRecord({
      userId: 'u3',
      venueId: 'sf-chapel',
      displayName: 'Old',
      now: new Date(now - 9 * 60 * 60 * 1000),
    })
    expect(isHeadingActive(stale, now)).toBe(false)
    expect(pickActiveHeading([cancelled, stale, fresh], 'sf-chapel', now)?.displayName).toBe('Kyle')
    expect(headingBannerCopy({
      displayName: 'Kyle',
      place: 'Mission',
      createdAt: fresh.createdAt,
      nowMs: now,
    })).toEqual({
      title: 'Kyle is heading here',
      meta: 'From a hop link · Mission · 5m ago',
    })
    expect(headingButtonLabel({ hop: true, selfActive: false })).toBe('Heading there too')
    expect(headingButtonLabel({ hop: false, selfActive: true })).toBe('Heading there')
  })

  it('builds hop share text without inventing a crowd', () => {
    expect(buildHopOgCopy({ venueName: 'The Chapel', displayName: 'Kyle' }).title).toBe(
      'Kyle is heading to The Chapel',
    )
    expect(hopTextInviteHref({
      displayName: 'Kyle',
      venueName: 'The Chapel',
      url: 'https://pulse-chi-nine.vercel.app/venue/sf-chapel?hop=1',
    })).toContain('sms:?&body=')
    expect(decodeURIComponent(hopTextInviteHref({
      displayName: 'Kyle',
      venueName: 'The Chapel',
      url: 'https://pulse-chi-nine.vercel.app/venue/sf-chapel?hop=1',
    }))).toContain('/venue/sf-chapel?hop=1')
  })
})
