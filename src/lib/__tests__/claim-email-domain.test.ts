import { describe, expect, it } from 'vitest'
import {
  isValidWorkEmail,
  normalizeOwnerDomain,
  workEmailMatchesVenue,
} from '../claim-email-domain'

describe('claim email domain', () => {
  it('normalizes website hosts and work emails', () => {
    expect(normalizeOwnerDomain('https://www.neumos.com/events')).toBe('neumos.com')
    expect(normalizeOwnerDomain('gm@neumos.com')).toBe('neumos.com')
    expect(normalizeOwnerDomain('neumos.com')).toBe('neumos.com')
    expect(normalizeOwnerDomain('not-a-domain')).toBeNull()
  })

  it('auto-verifies only when the work email domain matches', () => {
    expect(workEmailMatchesVenue('door@neumos.com', { website: 'https://neumos.com' })).toBe(true)
    expect(workEmailMatchesVenue('door@neumos.com', { ownerEmailDomain: 'neumos.com' })).toBe(true)
    expect(workEmailMatchesVenue('me@gmail.com', { website: 'https://neumos.com' })).toBe(false)
    expect(workEmailMatchesVenue('door@neumos.com', {})).toBe(false)
  })

  it('rejects incomplete emails', () => {
    expect(isValidWorkEmail('door@neumos.com')).toBe(true)
    expect(isValidWorkEmail('nope')).toBe(false)
  })
})
