import { describe, it, expect } from 'vitest'
import {
  getVenueDeepLink,
  getPulseDeepLink,
  generateVenueShareCard,
  generatePulseShareCard,
  generateJustReviewedShareCard,
  generateStoryShareText,
  getPublicAppOrigin,
  getVenueShareLandingPath,
  getImHereMapPath,
  getVenueShareOgImageUrl,
  buildShareOgCard,
  generateEnergyCardData,
  createReferralInvite,
  acceptReferralInvite,
  getReferralStats,
  buildNativeShareData,
  buildClipboardShareText,
} from '../sharing'
import type { Venue, Pulse } from '../types'

const venue: Venue = {
  id: 'v1',
  name: 'Test Bar',
  location: { lat: 40, lng: -74, address: '123 Main St' },
  pulseScore: 80,
  category: 'Bar',
  city: 'New York',
}

const pulse: Pulse = {
  id: 'p1',
  userId: 'u1',
  venueId: 'v1',
  photos: [],
  energyRating: 'electric',
  caption: 'Amazing vibes!',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  reactions: { fire: [], eyes: [], skull: [], lightning: [] },
  views: 0,
}

describe('deep links', () => {
  it('uses the public Pulse origin when no window is present', () => {
    expect(getPublicAppOrigin({ env: {}, locationOrigin: null })).toBe('https://pulse-chi-nine.vercel.app')
    expect(getVenueDeepLink('v1', 'https://pulse-chi-nine.vercel.app')).toBe('https://pulse-chi-nine.vercel.app/venue/v1')
    expect(getPublicAppOrigin({ locationOrigin: 'https://example.com/' })).toBe('https://example.com')
  })

  it('generates pulse deep link', () => {
    expect(getPulseDeepLink('p1', 'https://pulse.app')).toBe('https://pulse.app/pulse/p1')
  })

  it('supports custom base URL', () => {
    expect(getVenueDeepLink('v1', 'https://example.com')).toBe('https://example.com/venue/v1')
  })

  it('builds I’m-here map path and share landing that match the OG card', () => {
    expect(getVenueShareLandingPath('v1')).toBe('/venue/v1?from=share')
    expect(getImHereMapPath('v1')).toBe('/?here=v1')
    expect(getVenueShareOgImageUrl('v1', 'https://pulse.example')).toBe(
      'https://pulse.example/api/share/og?venueId=v1',
    )
    const card = buildShareOgCard({
      venueName: 'Neumos',
      energyLabel: 'Electric',
      freshness: '12m ago',
      caption: 'DJ just switched — floor is packed.',
    })
    expect(card.eyebrow).toBe('Someone shared a venue')
    expect(card.title).toBe('Neumos')
    expect(card.energyLine).toBe('Electric · 12m ago')
    expect(card.caption).toContain('floor is packed')
    expect(card.cta).toBe("I'm here · open map")
  })
})

describe('generateVenueShareCard', () => {
  it('generates a share card with correct fields', () => {
    const card = generateVenueShareCard(venue)
    expect(card.title).toBe('Test Bar')
    expect(card.energyLabel).toBe('Electric')
    expect(card.score).toBe(80)
    expect(card.url).toContain('/venue/v1')
    expect(card.description).toContain('Bar')
    expect(card.description).toContain('New York')
  })
})

describe('generatePulseShareCard', () => {
  it('generates a pulse share card', () => {
    const card = generatePulseShareCard(pulse, venue, 'alice')
    expect(card.title).toContain('alice')
    expect(card.title).toContain('Test Bar')
    expect(card.url).toContain('/venue/v1')
  })

  it('builds a just-reviewed card', () => {
    const card = generateJustReviewedShareCard(venue, 'DJ just started')
    expect(card.title).toContain('Just reviewed')
    expect(card.description).toContain('DJ just started')
    expect(card.url).toContain('/venue/v1')
  })
})

describe('generateStoryShareText', () => {
  it('includes venue name and energy', () => {
    const text = generateStoryShareText(venue)
    expect(text).toContain('Test Bar')
    expect(text).toContain('Electric')
    expect(text).toContain('80/100')
  })
})

describe('generateEnergyCardData', () => {
  it('returns all card data fields', () => {
    const data = generateEnergyCardData(venue)
    expect(data.venueName).toBe('Test Bar')
    expect(data.label).toBe('Electric')
    expect(data.emoji).toBe('⚡')
    expect(data.city).toBe('New York')
    expect(data.tagline.length).toBeGreaterThan(0)
  })
})

describe('referrals', () => {
  it('creates a referral invite', () => {
    const invite = createReferralInvite('u1')
    expect(invite.inviterId).toBe('u1')
    expect(invite.status).toBe('pending')
    expect(invite.inviteCode.length).toBe(6)
  })

  it('accepts a referral invite', () => {
    const invite = createReferralInvite('u1')
    const accepted = acceptReferralInvite(invite, 'u2')
    expect(accepted.status).toBe('accepted')
    expect(accepted.acceptedByUserId).toBe('u2')
  })

  it('calculates referral stats', () => {
    const invites = [
      createReferralInvite('u1'),
      acceptReferralInvite(createReferralInvite('u1'), 'u2'),
      createReferralInvite('u1'),
    ]
    const stats = getReferralStats(invites, 'u1')
    expect(stats.totalInvitesSent).toBe(3)
    expect(stats.totalAccepted).toBe(1)
    expect(stats.conversionRate).toBeCloseTo(1 / 3)
  })
})

describe('share helpers', () => {
  it('builds native share data', () => {
    const card = generateVenueShareCard(venue)
    const data = buildNativeShareData(card)
    expect(data.title).toBe(card.title)
    expect(data.text).toBe(card.description)
    expect(data.url).toBe(card.url)
  })

  it('builds clipboard text', () => {
    const card = generateVenueShareCard(venue)
    const text = buildClipboardShareText(card)
    expect(text).toContain(card.title)
    expect(text).toContain(card.url)
  })
})
