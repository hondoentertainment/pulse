import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearWelcomeSeenForTests,
  hasSeenWelcome,
  markWelcomeSeen,
  shouldRedirectToWelcome,
} from '../welcome-gate'

describe('welcome-gate', () => {
  beforeEach(() => {
    clearWelcomeSeenForTests()
  })

  it('redirects first visit on home only', () => {
    expect(shouldRedirectToWelcome('/')).toBe(true)
    expect(shouldRedirectToWelcome('/map')).toBe(false)
    markWelcomeSeen()
    expect(hasSeenWelcome()).toBe(true)
    expect(shouldRedirectToWelcome('/')).toBe(false)
  })
})
