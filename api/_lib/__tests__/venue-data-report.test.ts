import { describe, it, expect } from 'vitest'
import { validateBody, validateProposedFields } from '../../venues/data-report'

describe('validateBody (venue data report)', () => {
  it('accepts a valid report', () => {
    const result = validateBody({
      venueId: 'venue-1',
      reason: 'wrong_hours',
      note: 'Closes at 1am not 2am',
    })
    expect(result.ok).toBe(true)
  })

  it('accepts structured proposed fields', () => {
    const result = validateBody({
      venueId: 'venue-1',
      reason: 'wrong_phone',
      proposedFields: { phone: '(206) 555-0100' },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.proposedFields).toEqual({ phone: '(206) 555-0100' })
    }
  })

  it('rejects missing venueId', () => {
    const result = validateBody({ reason: 'other' })
    expect(result.ok).toBe(false)
  })

  it('rejects invalid reason', () => {
    const result = validateBody({ venueId: 'v1', reason: 'bogus' })
    expect(result.ok).toBe(false)
  })

  it('rejects unsupported proposed field keys', () => {
    const result = validateBody({
      venueId: 'v1',
      reason: 'other',
      proposedFields: { capacity: '200' },
    })
    expect(result.ok).toBe(false)
  })
})

describe('validateProposedFields', () => {
  it('trims and drops empty values', () => {
    const result = validateProposedFields({
      hours: '  Mon-Fri 5pm-1am  ',
      address: '   ',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ hours: 'Mon-Fri 5pm-1am' })
    }
  })

  it('rejects oversized phone numbers', () => {
    const result = validateProposedFields({
      phone: '1'.repeat(50),
    })
    expect(result.ok).toBe(false)
  })
})
