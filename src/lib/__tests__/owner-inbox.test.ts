import { describe, expect, it } from 'vitest'
import type { ContentReport } from '../content-moderation'
import type { Pulse } from '../types'
import type { VenueClaim } from '../venue-owner'
import {
  countTonightReports,
  createOwnerOneTapReply,
  createOwnerReply,
  OWNER_ONE_TAP_REPLY,
  dismissReportsForPulse,
  mapPulseReportsToContentReports,
  mergeInboxReports,
  shouldLoadOwnerInboxReports,
  summarizeOwnerInbox,
} from '../owner-inbox'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'patron',
    venueId: 'neumos',
    photos: [],
    energyRating: 'electric',
    caption: 'Best set of the week.',
    kind: 'review',
    hasBody: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeReport(overrides: Partial<ContentReport> = {}): ContentReport {
  return {
    id: 'r1',
    reporterId: 'u2',
    targetType: 'pulse',
    targetId: 'p1',
    reason: 'spam',
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...overrides,
  }
}

describe('owner inbox v2', () => {
  it('counts tonight reviews and pending reports', () => {
    const pulses = [makePulse(), makePulse({ id: 'p2', caption: 'Two' })]
    const summary = summarizeOwnerInbox({
      pulses,
      venueId: 'neumos',
      reports: [makeReport(), makeReport({ id: 'r2', targetId: 'p2' })],
    })
    expect(summary.reviewCount).toBe(2)
    expect(summary.reportCount).toBe(2)
  })

  it('dismisses reports for a pulse', () => {
    const next = dismissReportsForPulse([makeReport(), makeReport({ id: 'r2', targetId: 'other' })], 'p1')
    expect(next[0].status).toBe('dismissed')
    expect(next[1].status).toBe('pending')
  })

  it('creates a reply and ignores empty bodies', () => {
    expect(createOwnerReply({ pulseId: 'p1', venueId: 'neumos', body: '   ' })).toBeNull()
    const reply = createOwnerReply({ pulseId: 'p1', venueId: 'neumos', body: 'Thanks for coming' })
    expect(reply?.body).toBe('Thanks for coming')
    expect(createOwnerOneTapReply({ pulseId: 'p1', venueId: 'neumos' })?.body).toBe(OWNER_ONE_TAP_REPLY)
  })

  it('ignores dismissed reports in the count', () => {
    expect(countTonightReports(
      [makeReport({ status: 'dismissed' })],
      [makePulse()],
    )).toBe(0)
  })

  it('maps server pulse_reports onto inbox ContentReport rows', () => {
    const mapped = mapPulseReportsToContentReports([{
      id: 'r-server',
      pulse_id: 'p1',
      reporter_id: 'u9',
      reason: 'spam',
      details: 'bot',
      created_at: '2026-09-12T01:00:00.000Z',
      status: 'pending',
    }])
    expect(mapped).toEqual([expect.objectContaining({
      id: 'r-server',
      targetType: 'pulse',
      targetId: 'p1',
      reason: 'spam',
      status: 'pending',
    })])
  })

  it('loads reports only after a verified claim or staff role is ready', () => {
    const pending: VenueClaim = {
      id: 'c1',
      venueId: 'neumos',
      claimantUserId: 'owner-1',
      businessName: 'Neumos',
      businessEmail: 'gm@neumos.com',
      verificationMethod: 'email',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const verified = { ...pending, status: 'verified' as const }
    expect(shouldLoadOwnerInboxReports({
      userId: 'owner-1',
      venueId: 'neumos',
      claims: [verified],
      claimsReady: false,
    })).toBe(false)
    expect(shouldLoadOwnerInboxReports({
      userId: 'owner-1',
      venueId: 'neumos',
      claims: [pending],
      claimsReady: true,
    })).toBe(false)
    expect(shouldLoadOwnerInboxReports({
      userId: 'owner-1',
      venueId: 'neumos',
      claims: [verified],
      claimsReady: true,
    })).toBe(true)
    expect(shouldLoadOwnerInboxReports({
      userId: 'staff-1',
      venueId: 'neumos',
      claims: [],
      staffRoles: [{ venueId: 'neumos', userId: 'staff-1' }],
      claimsReady: true,
    })).toBe(true)
  })

  it('merges server reports with a local dismiss', () => {
    const server = [makeReport({ id: 'r1', status: 'pending' })]
    const local = [makeReport({ id: 'r1', status: 'dismissed' }), makeReport({ id: 'r2', targetId: 'p2' })]
    const merged = mergeInboxReports(server, local)
    expect(merged.find((row) => row.id === 'r1')?.status).toBe('dismissed')
    expect(merged.find((row) => row.id === 'r2')?.targetId).toBe('p2')
  })
})
