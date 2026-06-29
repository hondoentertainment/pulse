import { describe, it, expect } from 'vitest'
import {
  validateDeleteConfirmation,
  EXPORT_TABLES,
} from '../account-lifecycle'

describe('validateDeleteConfirmation', () => {
  it('accepts explicit DELETE confirmation', () => {
    expect(validateDeleteConfirmation({ confirm: 'DELETE' })).toBe(true)
  })

  it('rejects missing or wrong confirmation', () => {
    expect(validateDeleteConfirmation({})).toBe(false)
    expect(validateDeleteConfirmation({ confirm: 'delete' })).toBe(false)
    expect(validateDeleteConfirmation(null)).toBe(false)
    expect(validateDeleteConfirmation('DELETE')).toBe(false)
  })
})

describe('EXPORT_TABLES', () => {
  it('includes profile and core social tables', () => {
    const keys = EXPORT_TABLES.map(t => t.key)
    expect(keys).toContain('profile')
    expect(keys).toContain('pulses')
    expect(keys).toContain('notifications')
  })

  it('redacts push token secrets', () => {
    const push = EXPORT_TABLES.find(t => t.key === 'push_tokens')
    expect(push?.redactFields).toContain('token')
  })
})
