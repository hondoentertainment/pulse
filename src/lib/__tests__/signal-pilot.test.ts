import { describe, expect, it } from 'vitest'
import { classifyPilotPersistError, isValidPilotEmail, normalizePilotEmail } from '@/lib/signal-pilot'

describe('signal-pilot', () => {
  it('normalizes and validates email', () => {
    expect(normalizePilotEmail('  Ada@Pulse.app ')).toBe('ada@pulse.app')
    expect(isValidPilotEmail('ada@pulse.app')).toBe(true)
    expect(isValidPilotEmail('not-an-email')).toBe(false)
  })

  it('treats unique violations as already registered', () => {
    expect(classifyPilotPersistError({ code: '23505' })).toBe('already_registered')
    expect(classifyPilotPersistError({ message: 'duplicate key value' })).toBe('already_registered')
    expect(classifyPilotPersistError({ message: 'network down' })).toBe('failed')
    expect(classifyPilotPersistError(null)).toBe('created')
  })
})
