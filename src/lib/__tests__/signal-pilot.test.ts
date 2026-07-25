import { describe, expect, it } from 'vitest'
import { isValidEmail } from '@/lib/signal-pilot'

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const good of ['a@b.co', 'first.last@example.com', 'user+tag@sub.domain.org']) {
      expect(isValidEmail(good)).toBe(true)
    }
  })

  it('trims surrounding whitespace before validating', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    for (const bad of ['', 'plainstring', 'no@domain', '@example.com', 'user@', 'a b@example.com', 'two@@example.com']) {
      expect(isValidEmail(bad)).toBe(false)
    }
  })
})
