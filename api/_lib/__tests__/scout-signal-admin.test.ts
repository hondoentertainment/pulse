import { describe, it, expect } from 'vitest'
import { validateBody } from '../../integrations/places-enrich'
import { validateBody as validateSuppressBody } from '../../admin/signal-suppress'
import { validateReviewBody } from '../../admin/scout-applications'
import { validateBody as validateScoutApplyBody } from '../../scouts/apply'

describe('validateBody (places-enrich)', () => {
  it('accepts a minimal enrich request', () => {
    const result = validateBody({ venue_id: 'venue-1' })
    expect(result.ok).toBe(true)
  })

  it('rejects missing venue_id', () => {
    const result = validateBody({ dry_run: true })
    expect(result.ok).toBe(false)
  })

  it('rejects invalid coordinates', () => {
    const result = validateBody({ venue_id: 'v1', lat: 120 })
    expect(result.ok).toBe(false)
  })
})

describe('validateBody (signal-suppress)', () => {
  it('accepts suppress toggle', () => {
    const result = validateSuppressBody({
      venue_id: 'v1',
      suppressed: true,
      reason: 'spam',
    })
    expect(result.ok).toBe(true)
  })

  it('requires suppressed boolean', () => {
    const result = validateSuppressBody({ venue_id: 'v1' })
    expect(result.ok).toBe(false)
  })
})

describe('validateReviewBody (scout applications)', () => {
  it('accepts approve action', () => {
    const result = validateReviewBody({
      application_id: 'app-1',
      action: 'approve',
      tier: 'regular',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects invalid action', () => {
    const result = validateReviewBody({ application_id: 'app-1', action: 'hold' })
    expect(result.ok).toBe(false)
  })
})

describe('validateBody (scout apply)', () => {
  it('accepts optional motivation and neighborhoods', () => {
    const result = validateScoutApplyBody({
      motivation: 'I know Capitol Hill',
      neighborhoods: ['Capitol Hill', 'Fremont'],
    })
    expect(result.ok).toBe(true)
  })
})
