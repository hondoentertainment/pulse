import { describe, it, expect } from 'vitest'
import { validateBody } from '../../venues/data-report'

describe('validateBody (venue data report)', () => {
  it('accepts a valid report', () => {
    const result = validateBody({
      venueId: 'venue-1',
      reason: 'wrong_hours',
      note: 'Closes at 1am not 2am',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects missing venueId', () => {
    const result = validateBody({ reason: 'other' })
    expect(result.ok).toBe(false)
  })

  it('rejects invalid reason', () => {
    const result = validateBody({ venueId: 'v1', reason: 'bogus' })
    expect(result.ok).toBe(false)
  })
})
