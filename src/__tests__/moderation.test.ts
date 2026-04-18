/**
 * Unit tests for the moderation and abuse-prevention system.
 *
 * Covers:
 *  - src/lib/moderation.ts   (report lifecycle)
 *  - src/lib/rate-limiter.ts (sliding-window RateLimiter class + default limits)
 *  - src/lib/spam-detection.ts (detectSpam, isDuplicateContent, detectSuspiciousPattern)
 */

import { describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Moderation library
// ---------------------------------------------------------------------------
import {
  submitReport,
  getReportsForContent,
  getAllReports,
  resolveReport,
  dismissReport,
  getReportsByStatus,
  getActionsForReport,
  clearModerationStore,
} from '@/lib/moderation'

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------
import {
  RateLimiter,
  defaultRateLimiter,
  DEFAULT_LIMITS,
  checkDefaultLimit,
  clearAllRateLimits,
} from '@/lib/rate-limiter'

// ---------------------------------------------------------------------------
// Spam detection
// ---------------------------------------------------------------------------
import {
  detectSpam,
  isDuplicateContent,
  detectSuspiciousPattern,
  clearDuplicateContentStore,
} from '@/lib/spam-detection'

// ===========================================================================
// 1. Moderation — report lifecycle
// ===========================================================================

describe('Moderation — submitReport', () => {
  beforeEach(() => clearModerationStore())

  it('creates a report with a unique id, pending status, and ISO timestamp', () => {
    const report = submitReport({
      reporterId: 'user-1',
      contentType: 'pulse',
      contentId: 'pulse-abc',
      reason: 'spam',
    })

    expect(report.id).toMatch(/^report-/)
    expect(report.status).toBe('pending')
    expect(report.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(report.reporterId).toBe('user-1')
    expect(report.contentId).toBe('pulse-abc')
    expect(report.reason).toBe('spam')
  })

  it('stores an optional description', () => {
    const report = submitReport({
      reporterId: 'user-2',
      contentType: 'story',
      contentId: 'story-1',
      reason: 'harassment',
      description: 'This is very offensive',
    })
    expect(report.description).toBe('This is very offensive')
  })

  it('generates distinct ids for consecutive reports', () => {
    const r1 = submitReport({ reporterId: 'u1', contentType: 'pulse', contentId: 'p1', reason: 'spam' })
    const r2 = submitReport({ reporterId: 'u2', contentType: 'pulse', contentId: 'p1', reason: 'inappropriate' })
    expect(r1.id).not.toBe(r2.id)
  })
})

describe('Moderation — getReportsForContent', () => {
  beforeEach(() => clearModerationStore())

  it('returns only reports matching the contentId', () => {
    submitReport({ reporterId: 'u1', contentType: 'pulse', contentId: 'p1', reason: 'spam' })
    submitReport({ reporterId: 'u2', contentType: 'pulse', contentId: 'p2', reason: 'spam' })
    submitReport({ reporterId: 'u3', contentType: 'pulse', contentId: 'p1', reason: 'harassment' })

    const forP1 = getReportsForContent('p1')
    expect(forP1).toHaveLength(2)
    expect(forP1.every(r => r.contentId === 'p1')).toBe(true)
  })

  it('returns an empty array when no reports exist for the content', () => {
    expect(getReportsForContent('nonexistent')).toHaveLength(0)
  })
})

describe('Moderation — resolveReport', () => {
  beforeEach(() => clearModerationStore())

  it('updates report status to actioned and records the action', () => {
    const report = submitReport({ reporterId: 'u1', contentType: 'pulse', contentId: 'p1', reason: 'spam' })

    const result = resolveReport(report.id, {
      action: 'remove_content',
      moderatorId: 'mod-1',
      reason: 'Confirmed spam',
    })

    expect(result).not.toBeNull()
    expect(result!.report.status).toBe('actioned')
    expect(result!.action.action).toBe('remove_content')
    expect(result!.action.moderatorId).toBe('mod-1')
    expect(result!.action.reportId).toBe(report.id)
  })

  it('supports all four action types', () => {
    const actions = ['warn', 'remove_content', 'temp_ban', 'permanent_ban'] as const
    for (const action of actions) {
      clearModerationStore()
      const r = submitReport({ reporterId: 'u1', contentType: 'pulse', contentId: 'p1', reason: 'spam' })
      const result = resolveReport(r.id, { action, moderatorId: 'mod', reason: 'test' })
      expect(result!.report.status).toBe('actioned')
      expect(result!.action.action).toBe(action)
    }
  })

  it('returns null for an unknown reportId', () => {
    expect(resolveReport('no-such-id', { action: 'warn', moderatorId: 'mod', reason: 'test' })).toBeNull()
  })

  it('records the action in getActionsForReport', () => {
    const r = submitReport({ reporterId: 'u1', contentType: 'pulse', contentId: 'p1', reason: 'spam' })
    resolveReport(r.id, { action: 'warn', moderatorId: 'mod', reason: 'Warned' })

    const actions = getActionsForReport(r.id)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('warn')
  })
})

describe('Moderation — dismissReport', () => {
  beforeEach(() => clearModerationStore())

  it('sets the report status to dismissed', () => {
    const r = submitReport({ reporterId: 'u1', contentType: 'reaction', contentId: 'r1', reason: 'other' })
    const dismissed = dismissReport(r.id)
    expect(dismissed).not.toBeNull()
    expect(dismissed!.status).toBe('dismissed')
  })

  it('returns null for an unknown reportId', () => {
    expect(dismissReport('ghost')).toBeNull()
  })
})

describe('Moderation — getReportsByStatus', () => {
  beforeEach(() => clearModerationStore())

  it('filters correctly by each status', () => {
    const r1 = submitReport({ reporterId: 'u1', contentType: 'pulse', contentId: 'p1', reason: 'spam' })
    const r2 = submitReport({ reporterId: 'u2', contentType: 'pulse', contentId: 'p2', reason: 'spam' })
    dismissReport(r1.id)
    resolveReport(r2.id, { action: 'warn', moderatorId: 'mod', reason: 'x' })

    const pending  = getReportsByStatus('pending')
    const dismissed = getReportsByStatus('dismissed')
    const actioned  = getReportsByStatus('actioned')

    expect(pending).toHaveLength(0)
    expect(dismissed).toHaveLength(1)
    expect(actioned).toHaveLength(1)
  })
})

describe('Moderation — getAllReports', () => {
  beforeEach(() => clearModerationStore())

  it('returns all submitted reports regardless of status', () => {
    submitReport({ reporterId: 'u1', contentType: 'pulse', contentId: 'p1', reason: 'spam' })
    submitReport({ reporterId: 'u2', contentType: 'story', contentId: 's1', reason: 'other' })
    expect(getAllReports()).toHaveLength(2)
  })
})

// ===========================================================================
// 2. Rate Limiter — sliding window
// ===========================================================================

describe('RateLimiter — sliding window', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter()
  })

  it('allows actions up to the maximum in the window', () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000)
      expect(result.allowed).toBe(true)
    }
  })

  it('blocks the (maxActions + 1)th action in the same window', () => {
    for (let i = 0; i < 5; i++) {
      limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000)
    }
    const blocked = limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('provides a retryAfter value in seconds when blocked', () => {
    for (let i = 0; i < 3; i++) limiter.checkLimit('u1', 'test', 3, 60_000)
    const result = limiter.checkLimit('u1', 'test', 3, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeTypeOf('number')
    expect(result.retryAfter!).toBeGreaterThan(0)
    expect(result.retryAfter!).toBeLessThanOrEqual(60)
  })

  it('tracks limits independently per user', () => {
    for (let i = 0; i < 5; i++) limiter.checkLimit('user-A', 'act', 5, 3600_000)
    // user-B should still have their own full quota
    const result = limiter.checkLimit('user-B', 'act', 5, 3600_000)
    expect(result.allowed).toBe(true)
  })

  it('tracks limits independently per action', () => {
    for (let i = 0; i < 5; i++) limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000)
    const result = limiter.checkLimit('user-1', 'reaction', 5, 3600_000)
    expect(result.allowed).toBe(true)
  })

  it('reset() clears state for the specified user/action pair', () => {
    for (let i = 0; i < 5; i++) limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000)
    limiter.reset('user-1', 'pulse_create')
    expect(limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000).allowed).toBe(true)
  })

  it('clear() clears all stored state', () => {
    for (let i = 0; i < 5; i++) limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000)
    limiter.clear()
    expect(limiter.checkLimit('user-1', 'pulse_create', 5, 3600_000).allowed).toBe(true)
  })
})

describe('RateLimiter — default limits', () => {
  beforeEach(() => {
    defaultRateLimiter.clear()
    clearAllRateLimits()
  })

  it('DEFAULT_LIMITS has correct configuration for pulse_create', () => {
    expect(DEFAULT_LIMITS.pulse_create.maxActions).toBe(5)
    expect(DEFAULT_LIMITS.pulse_create.windowMs).toBe(60 * 60 * 1000)
  })

  it('DEFAULT_LIMITS has correct configuration for reaction', () => {
    expect(DEFAULT_LIMITS.reaction.maxActions).toBe(30)
    expect(DEFAULT_LIMITS.reaction.windowMs).toBe(60 * 1000)
  })

  it('DEFAULT_LIMITS has correct configuration for report', () => {
    expect(DEFAULT_LIMITS.report.maxActions).toBe(10)
    expect(DEFAULT_LIMITS.report.windowMs).toBe(24 * 60 * 60 * 1000)
  })

  it('checkDefaultLimit allows actions within quota', () => {
    const result = checkDefaultLimit('u1', 'pulse_create')
    expect(result.allowed).toBe(true)
  })

  it('checkDefaultLimit blocks after exceeding pulse_create quota', () => {
    for (let i = 0; i < 5; i++) checkDefaultLimit('u2', 'pulse_create')
    const blocked = checkDefaultLimit('u2', 'pulse_create')
    expect(blocked.allowed).toBe(false)
  })

  it('checkDefaultLimit blocks after exceeding reaction quota', () => {
    for (let i = 0; i < 30; i++) checkDefaultLimit('u3', 'reaction')
    const blocked = checkDefaultLimit('u3', 'reaction')
    expect(blocked.allowed).toBe(false)
  })
})

// ===========================================================================
// 3. Spam Detection
// ===========================================================================

describe('detectSpam — clean content', () => {
  it('returns isSpam false for normal short caption', () => {
    const result = detectSpam('Great vibes tonight!')
    expect(result.isSpam).toBe(false)
    expect(result.confidence).toBeLessThan(0.5)
    expect(result.reasons).toHaveLength(0)
  })

  it('returns isSpam false for normal longer caption', () => {
    const result = detectSpam('The rooftop bar is absolutely packed tonight, energy is off the charts!')
    expect(result.isSpam).toBe(false)
  })

  it('confidence is between 0 and 1', () => {
    const result = detectSpam('hello world')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})

describe('detectSpam — repeated characters', () => {
  it('flags content with 6+ repeated identical characters', () => {
    const result = detectSpam('aaaaaaa this place is great')
    expect(result.reasons.some(r => r.includes('repetition'))).toBe(true)
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('does not flag short runs of repeated characters', () => {
    const result = detectSpam('sooo good tonight') // 3 os
    expect(result.reasons.some(r => r.includes('repetition'))).toBe(false)
  })
})

describe('detectSpam — all caps', () => {
  it('flags content that is all uppercase (> 5 chars)', () => {
    const result = detectSpam('LOUD NIGHT AT THE CLUB')
    expect(result.reasons.some(r => r.toLowerCase().includes('capital'))).toBe(true)
  })

  it('does not flag single uppercase words or short text', () => {
    // "OK" — 2 chars, skipped by length guard
    const result = detectSpam('OK')
    expect(result.reasons.some(r => r.toLowerCase().includes('capital'))).toBe(false)
  })
})

describe('detectSpam — URLs', () => {
  it('flags content containing an http URL', () => {
    const result = detectSpam('Check out https://example.com for deals')
    expect(result.reasons.some(r => r.includes('URL'))).toBe(true)
  })

  it('flags content containing a www URL', () => {
    const result = detectSpam('Visit www.example.com now')
    expect(result.reasons.some(r => r.includes('URL'))).toBe(true)
  })

  it('does not flag content with no URL', () => {
    const result = detectSpam('Just a normal caption about the venue')
    expect(result.reasons.some(r => r.includes('URL'))).toBe(false)
  })
})

describe('detectSpam — very short content', () => {
  it('flags a 1-character string as too short', () => {
    const result = detectSpam('a')
    expect(result.reasons.some(r => r.includes('too short'))).toBe(true)
  })

  it('flags a 2-character string as too short', () => {
    const result = detectSpam('ab')
    expect(result.reasons.some(r => r.includes('too short'))).toBe(true)
  })

  it('does not flag a 3-character string for length', () => {
    const result = detectSpam('yay')
    expect(result.reasons.some(r => r.includes('too short'))).toBe(false)
  })

  it('does not flag empty string', () => {
    const result = detectSpam('')
    // Empty string should not be flagged as "too short" (no content = no pulse caption)
    expect(result.isSpam).toBe(false)
  })
})

describe('detectSpam — spam phrases', () => {
  it('flags content with "buy now"', () => {
    const result = detectSpam('buy now and get free money')
    expect(result.reasons.some(r => r.includes('spam phrase'))).toBe(true)
    expect(result.isSpam).toBe(true)
  })

  it('flags content with "click here"', () => {
    const result = detectSpam('click here to win')
    expect(result.reasons.some(r => r.includes('spam phrase'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isDuplicateContent
// ---------------------------------------------------------------------------

describe('isDuplicateContent', () => {
  beforeEach(() => clearDuplicateContentStore())

  it('returns false on the first submission', () => {
    expect(isDuplicateContent('u1', 'Great venue!')).toBe(false)
  })

  it('returns true for the same content submitted again by the same user', () => {
    isDuplicateContent('u1', 'Great venue!')
    expect(isDuplicateContent('u1', 'Great venue!')).toBe(true)
  })

  it('is case- and whitespace-insensitive', () => {
    isDuplicateContent('u1', 'Great venue!')
    expect(isDuplicateContent('u1', '  GREAT VENUE!  ')).toBe(true)
  })

  it('allows the same content from a different user', () => {
    isDuplicateContent('u1', 'Great venue!')
    expect(isDuplicateContent('u2', 'Great venue!')).toBe(false)
  })

  it('allows distinct content from the same user', () => {
    isDuplicateContent('u1', 'Great venue!')
    expect(isDuplicateContent('u1', 'Totally different caption')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// detectSuspiciousPattern
// ---------------------------------------------------------------------------

describe('detectSuspiciousPattern', () => {
  it('returns false for an empty action list', () => {
    expect(detectSuspiciousPattern('u1', [])).toBe(false)
  })

  it('returns false when a user has 3 or fewer identical actions in 1 minute', () => {
    const now = Date.now()
    const actions = [
      { type: 'pulse_create', timestamp: now - 10_000 },
      { type: 'pulse_create', timestamp: now - 20_000 },
      { type: 'pulse_create', timestamp: now - 30_000 },
    ]
    expect(detectSuspiciousPattern('u1', actions)).toBe(false)
  })

  it('returns true when a user performs the same action more than 3 times in 1 minute', () => {
    const now = Date.now()
    const actions = Array.from({ length: 4 }, (_, i) => ({
      type: 'pulse_create',
      timestamp: now - i * 5_000,
    }))
    expect(detectSuspiciousPattern('u1', actions)).toBe(true)
  })

  it('ignores actions outside the 1-minute window', () => {
    const now = Date.now()
    const actions = [
      // 4 actions but 3 are older than 1 minute
      { type: 'reaction', timestamp: now - 2 * 60_000 },
      { type: 'reaction', timestamp: now - 3 * 60_000 },
      { type: 'reaction', timestamp: now - 4 * 60_000 },
      { type: 'reaction', timestamp: now - 5_000 }, // only 1 in the window
    ]
    expect(detectSuspiciousPattern('u1', actions)).toBe(false)
  })

  it('evaluates each action type independently', () => {
    const now = Date.now()
    // 2 pulse_creates + 2 reactions — neither exceeds threshold of 3
    const actions = [
      { type: 'pulse_create', timestamp: now - 1_000 },
      { type: 'pulse_create', timestamp: now - 2_000 },
      { type: 'reaction',     timestamp: now - 3_000 },
      { type: 'reaction',     timestamp: now - 4_000 },
    ]
    expect(detectSuspiciousPattern('u1', actions)).toBe(false)
  })
})
