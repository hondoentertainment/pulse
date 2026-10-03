import { describe, expect, it } from 'vitest'
import {
  getVenueInviteLandingPath,
  getVenueInviteMapPath,
  getVenueInviteShareUrl,
  isInviteArrival,
} from '../invite-friend'

describe('invite a friend', () => {
  it('opens the venue with I’m-here primed and reuses share OG', () => {
    expect(getVenueInviteLandingPath('neumos')).toBe('/venue/neumos?from=invite')
    expect(getVenueInviteMapPath('neumos')).toBe('/?here=neumos')
    expect(isInviteArrival('?from=invite')).toBe(true)
    expect(isInviteArrival('?from=share')).toBe(false)
    expect(getVenueInviteShareUrl('neumos', 'https://pulse-chi-nine.vercel.app')).toBe(
      'https://pulse-chi-nine.vercel.app/api/share/venue?venueId=neumos&from=invite',
    )
  })
})
