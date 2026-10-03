import { describe, expect, it } from 'vitest'
import { canAccessVenueInbox } from '../live-reviews'
import { applyClaimVerifiedFlags, rowToVenueClaim, type VenueClaimRow } from '../data/venue-claims'

function makeRow(overrides: Partial<VenueClaimRow> = {}): VenueClaimRow {
  return {
    id: 'claim-1',
    venue_id: 'venue-1',
    user_id: 'owner-1',
    status: 'pending',
    evidence: 'I manage the door',
    notes: 'The Showbox',
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
    reviewed_at: null,
    ...overrides,
  }
}

describe('rowToVenueClaim', () => {
  it('maps a pending server row', () => {
    const claim = rowToVenueClaim(makeRow())
    expect(claim.venueId).toBe('venue-1')
    expect(claim.claimantUserId).toBe('owner-1')
    expect(claim.status).toBe('pending')
    expect(claim.evidence).toBe('I manage the door')
    expect(claim.verifiedAt).toBeUndefined()
  })

  it('maps verified / rejected timestamps and notes', () => {
    const verified = rowToVenueClaim(makeRow({
      status: 'verified',
      reviewed_at: '2026-09-10T12:00:00.000Z',
    }))
    expect(verified.verifiedAt).toBe('2026-09-10T12:00:00.000Z')

    const rejected = rowToVenueClaim(makeRow({
      status: 'rejected',
      notes: 'Could not confirm ownership',
      reviewed_at: '2026-09-10T12:00:00.000Z',
    }))
    expect(rejected.rejectedReason).toBe('Could not confirm ownership')
  })
})

describe('claims access', () => {
  it('denies pending claims and allows verified or staff', () => {
    const pending = rowToVenueClaim(makeRow())
    const verified = rowToVenueClaim(makeRow({ status: 'verified' }))
    expect(canAccessVenueInbox({
      userId: 'owner-1',
      venueId: 'venue-1',
      claims: [pending],
    })).toBe(false)
    expect(canAccessVenueInbox({
      userId: 'owner-1',
      venueId: 'venue-1',
      claims: [verified],
    })).toBe(true)
    expect(canAccessVenueInbox({
      userId: 'staff-1',
      venueId: 'venue-1',
      staffRoles: [{ venueId: 'venue-1', userId: 'staff-1' }],
    })).toBe(true)
  })
})

describe('applyClaimVerifiedFlags', () => {
  it('marks only verified claim venue ids', () => {
    const venues = [
      { id: 'neumos', claimVerified: false },
      { id: 'barrio' },
    ]
    expect(applyClaimVerifiedFlags(venues, ['neumos'])).toEqual([
      { id: 'neumos', claimVerified: true },
      { id: 'barrio' },
    ])
  })
})
