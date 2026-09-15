/**
 * Text invite — sms: link with venue name + I’m-here URL in the body.
 * Uses the phone composer. No Twilio. Custom domain stays skipped.
 */

import { getVenueDeepLink, getPublicAppOrigin } from './sharing'
import { getVenueInviteLandingPath } from './invite-friend'

export const TEXT_INVITE_CTA = 'Text invite'

export function textInviteBody(input: {
  venueName: string
  venueId: string
  baseUrl?: string
}): string {
  const name = input.venueName.trim() || 'this room'
  const origin = input.baseUrl ?? getPublicAppOrigin()
  const url = `${origin.replace(/\/$/, '')}${getVenueInviteLandingPath(input.venueId)}`
  return `I’m here at ${name} — ${url}`
}

export function textInviteHref(input: {
  venueName: string
  venueId: string
  baseUrl?: string
}): string {
  const body = textInviteBody(input)
  return `sms:?&body=${encodeURIComponent(body)}`
}

export function textInviteDeepLinkFallback(venueId: string, baseUrl?: string): string {
  return getVenueDeepLink(venueId, baseUrl)
}
