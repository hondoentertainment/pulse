import { describe, expect, it } from 'vitest'
import {
  canSamePulse,
  formatSameCount,
  sameAuthPath,
  sameCountForPulse,
  toggleSameAgree,
  viewerAgreed,
} from '../pulse-same'

describe('Same agree', () => {
  it('allows one row per user per pulse and shows count only', () => {
    expect(canSamePulse(['line'])).toBe(true)
    expect(canSamePulse([])).toBe(false)
    const once = toggleSameAgree([], 'p1', 'me', '2026-09-14T04:00:00.000Z')
    expect(sameCountForPulse(once, 'p1')).toBe(1)
    expect(viewerAgreed(once, 'p1', 'me')).toBe(true)
    const twice = toggleSameAgree(once, 'p1', 'me')
    expect(sameCountForPulse(twice, 'p1')).toBe(0)
    const other = toggleSameAgree(once, 'p1', 'you')
    expect(formatSameCount(sameCountForPulse(other, 'p1'))).toBe('2')
    expect(sameAuthPath('neumos', 'p1')).toContain('/auth?next=')
  })
})
