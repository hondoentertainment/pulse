import { beforeEach, describe, expect, it } from 'vitest'
import {
  claimVenue,
  claimVenueForPilot,
  clearVenueClaimsForTests,
  getVerifiedClaimedVenueIds,
  getVerifiedClaimForVenue,
} from '../venue-claims'
import { clearVenueOperatorStatuses, getVenueOperatorStatus, updateVenueOperatorStatus } from '../venue-operator-live'

describe('venue-claims + operator persistence', () => {
  beforeEach(() => {
    clearVenueClaimsForTests('owner-1')
    clearVenueOperatorStatuses()
  })

  it('claims and verifies a venue for the pilot', () => {
    const claim = claimVenueForPilot('owner-1', 'venue-a', 'Neon Room', 'ops@neon.test')
    expect(claim.status).toBe('verified')
    expect(getVerifiedClaimedVenueIds('owner-1')).toEqual(['venue-a'])
    expect(getVerifiedClaimForVenue('owner-1', 'venue-a')?.businessName).toBe('Neon Room')
  })

  it('claimVenue without token falls back to local pilot verify', async () => {
    const claim = await claimVenue('owner-1', 'venue-b', 'Bar Two', 'ops@bar.test')
    expect(claim.status).toBe('verified')
    expect(getVerifiedClaimedVenueIds('owner-1')).toContain('venue-b')
  })


  it('persists operator status across store clears via localStorage', () => {
    updateVenueOperatorStatus('venue-a', 'owner-1', {
      guestListStatus: 'open',
      special: 'Free before 11',
    })
    expect(getVenueOperatorStatus('venue-a')?.updatedBy).toBe('owner-1')
    expect(getVenueOperatorStatus('venue-a')?.special).toBe('Free before 11')
  })
})
