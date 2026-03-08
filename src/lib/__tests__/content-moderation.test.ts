import { describe, it, expect } from 'vitest'
import {
  screenContent,
  createReport,
  isBlocked,
  isMuted,
  createBlock,
  createMute,
  filterModeratedPulses,
  getPendingReportCount,
  isAutoFlagged,
} from '../content-moderation'
import type { Pulse } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random()}`,
    userId: 'user-1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('screenContent', () => {
  it('returns empty for clean text', () => {
    expect(screenContent('Great vibes tonight!')).toEqual([])
  })

  it('returns empty for undefined', () => {
    expect(screenContent(undefined)).toEqual([])
  })

  it('detects spammy content', () => {
    const issues = screenContent('buy now at this great venue!')
    expect(issues.length).toBeGreaterThan(0)
  })

  it('flags overly long captions', () => {
    const longText = 'a'.repeat(501)
    const issues = screenContent(longText)
    expect(issues.some(i => i.includes('maximum length'))).toBe(true)
  })
})

describe('createReport', () => {
  it('creates a report with correct fields', () => {
    const report = createReport('reporter-1', 'pulse', 'pulse-123', 'spam', 'test')
    expect(report.reporterId).toBe('reporter-1')
    expect(report.targetType).toBe('pulse')
    expect(report.targetId).toBe('pulse-123')
    expect(report.reason).toBe('spam')
    expect(report.description).toBe('test')
    expect(report.status).toBe('pending')
    expect(report.id).toMatch(/^report-/)
  })
})

describe('isBlocked', () => {
  const blocks = [createBlock('user-1', 'user-2')]

  it('returns true for blocked user', () => {
    expect(isBlocked(blocks, 'user-1', 'user-2')).toBe(true)
  })

  it('returns true for reverse direction (bidirectional)', () => {
    expect(isBlocked(blocks, 'user-2', 'user-1')).toBe(true)
  })

  it('returns false for non-blocked user', () => {
    expect(isBlocked(blocks, 'user-1', 'user-3')).toBe(false)
  })
})

describe('isMuted', () => {
  const mutes = [createMute('user-1', 'user-2')]

  it('returns true for muted user', () => {
    expect(isMuted(mutes, 'user-1', 'user-2')).toBe(true)
  })

  it('returns false for reverse (muting is one-directional)', () => {
    expect(isMuted(mutes, 'user-2', 'user-1')).toBe(false)
  })
})

describe('filterModeratedPulses', () => {
  const blocks = [createBlock('me', 'blocked-user')]
  const mutes = [createMute('me', 'muted-user')]

  it('removes pulses from blocked users', () => {
    const pulses = [
      makePulse({ userId: 'normal-user' }),
      makePulse({ userId: 'blocked-user' }),
    ]
    const filtered = filterModeratedPulses(pulses, 'me', blocks, [])
    expect(filtered.length).toBe(1)
    expect(filtered[0].userId).toBe('normal-user')
  })

  it('removes pulses from muted users', () => {
    const pulses = [
      makePulse({ userId: 'normal-user' }),
      makePulse({ userId: 'muted-user' }),
    ]
    const filtered = filterModeratedPulses(pulses, 'me', [], mutes)
    expect(filtered.length).toBe(1)
  })

  it('keeps pulses from non-blocked/muted users', () => {
    const pulses = [makePulse({ userId: 'normal-user' })]
    const filtered = filterModeratedPulses(pulses, 'me', blocks, mutes)
    expect(filtered.length).toBe(1)
  })
})

describe('getPendingReportCount', () => {
  it('counts only pending reports', () => {
    const reports = [
      { ...createReport('r1', 'pulse', 'p1', 'spam'), status: 'pending' as const },
      { ...createReport('r2', 'pulse', 'p2', 'spam'), status: 'reviewed' as const },
      { ...createReport('r3', 'pulse', 'p3', 'spam'), status: 'pending' as const },
    ]
    expect(getPendingReportCount(reports)).toBe(2)
  })
})

describe('isAutoFlagged', () => {
  it('returns false when below threshold', () => {
    const reports = [
      { ...createReport('r1', 'user', 'user-bad', 'spam'), status: 'pending' as const },
    ]
    expect(isAutoFlagged(reports, 'user-bad')).toBe(false)
  })

  it('returns true when at or above threshold', () => {
    const reports = Array.from({ length: 5 }, (_, i) =>
      ({ ...createReport(`r-${i}`, 'user', 'user-bad', 'spam'), status: 'pending' as const })
    )
    expect(isAutoFlagged(reports, 'user-bad')).toBe(true)
  })

  it('only counts reports for the specific user', () => {
    const reports = [
      ...Array.from({ length: 5 }, (_, i) =>
        ({ ...createReport(`r-${i}`, 'user', 'other-user', 'spam'), status: 'pending' as const })
      ),
      { ...createReport('r-self', 'user', 'user-bad', 'spam'), status: 'pending' as const },
    ]
    expect(isAutoFlagged(reports, 'user-bad')).toBe(false)
  })
})
