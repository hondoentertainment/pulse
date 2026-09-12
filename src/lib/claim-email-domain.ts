/**
 * Self-serve venue claim: work-email domain must match a public venue
 * website host or `venues.owner_email_domain`. Pending stays pending
 * when there is no match. Never auto-verifies on pending alone.
 */

export function normalizeOwnerDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.trim().toLowerCase()
  if (!value) return null
  value = value.replace(/^mailto:/, '')
  if (value.includes('@')) {
    value = value.slice(value.lastIndexOf('@') + 1)
  }
  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '')
  value = value.split('/')[0]?.split(':')[0]?.split('?')[0] ?? ''
  if (!value || !value.includes('.')) return null
  return value
}

export function venueOwnerMatchDomains(input: {
  ownerEmailDomain?: string | null
  website?: string | null
}): string[] {
  const domains: string[] = []
  const stored = normalizeOwnerDomain(input.ownerEmailDomain)
  if (stored) domains.push(stored)
  const website = normalizeOwnerDomain(input.website)
  if (website && !domains.includes(website)) domains.push(website)
  return domains
}

export function workEmailMatchesVenue(
  workEmail: string,
  venue: { ownerEmailDomain?: string | null; website?: string | null },
): boolean {
  const emailDomain = normalizeOwnerDomain(workEmail)
  if (!emailDomain) return false
  return venueOwnerMatchDomains(venue).includes(emailDomain)
}

export function isValidWorkEmail(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 6 || trimmed.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export const CLAIM_DOMAIN_COPY = {
  workEmailLabel: 'Work email',
  workEmailHint: 'Use the address on the venue website domain. We send a magic link / OTP to confirm it.',
  pendingNoMatch: 'Claim stays pending — that email domain does not match this venue’s public website.',
  verifyAfterConfirm: 'Confirm the magic link / OTP for that work email. If the domain matches, the claim verifies without an admin.',
  verified: 'Claim verified from your work email domain.',
} as const
