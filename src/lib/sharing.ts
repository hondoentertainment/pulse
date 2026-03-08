import type { Venue, Pulse, EnergyRating } from './types'
import { getEnergyLabel } from './pulse-engine'

/**
 * Sharing & Virality Engine
 *
 * Deep links, social media share cards, venue sharing,
 * and referral tracking.
 */

export interface ShareCard {
  title: string
  description: string
  imageText: string
  energyLabel: string
  energyColor: string
  score: number
  url: string
}

export interface ReferralInvite {
  id: string
  inviterId: string
  inviteCode: string
  createdAt: string
  acceptedByUserId?: string
  acceptedAt?: string
  status: 'pending' | 'accepted' | 'expired'
}

export interface ReferralStats {
  totalInvitesSent: number
  totalAccepted: number
  conversionRate: number
}

const ENERGY_COLORS: Record<string, string> = {
  Electric: '#E040FB',
  Buzzing: '#FF9800',
  Chill: '#4CAF50',
  Dead: '#607D8B',
}

/**
 * Generate a deep link URL for a venue.
 */
export function getVenueDeepLink(venueId: string, baseUrl: string = 'https://pulse.app'): string {
  return `${baseUrl}/venue/${venueId}`
}

/**
 * Generate a deep link URL for a pulse.
 */
export function getPulseDeepLink(pulseId: string, baseUrl: string = 'https://pulse.app'): string {
  return `${baseUrl}/pulse/${pulseId}`
}

/**
 * Generate a share card for a venue.
 */
export function generateVenueShareCard(venue: Venue): ShareCard {
  const label = getEnergyLabel(venue.pulseScore)
  return {
    title: venue.name,
    description: `${venue.category ?? 'Venue'}${venue.city ? ` in ${venue.city}` : ''} — ${label} right now`,
    imageText: `${venue.name}\n${label} ${venue.pulseScore}/100`,
    energyLabel: label,
    energyColor: ENERGY_COLORS[label] ?? ENERGY_COLORS.Dead,
    score: venue.pulseScore,
    url: getVenueDeepLink(venue.id),
  }
}

/**
 * Generate a share card for a pulse.
 */
export function generatePulseShareCard(pulse: Pulse, venue: Venue, username: string): ShareCard {
  const label = getEnergyLabel(venue.pulseScore)
  return {
    title: `${username} at ${venue.name}`,
    description: pulse.caption ?? `${label} energy right now`,
    imageText: `${venue.name}\n${pulse.energyRating.toUpperCase()}`,
    energyLabel: label,
    energyColor: ENERGY_COLORS[label] ?? ENERGY_COLORS.Dead,
    score: venue.pulseScore,
    url: getPulseDeepLink(pulse.id),
  }
}

/**
 * Generate share text for Instagram/TikTok story.
 */
export function generateStoryShareText(venue: Venue): string {
  const label = getEnergyLabel(venue.pulseScore)
  const emoji = label === 'Electric' ? '⚡' : label === 'Buzzing' ? '🔥' : label === 'Chill' ? '😌' : '💀'
  return `${emoji} ${venue.name} is ${label} right now — ${venue.pulseScore}/100 on Pulse`
}

/**
 * Generate a branded energy card text (for image generation).
 */
export function generateEnergyCardData(venue: Venue): {
  venueName: string
  category: string
  city: string
  score: number
  label: string
  emoji: string
  color: string
  tagline: string
} {
  const label = getEnergyLabel(venue.pulseScore)
  const emojis: Record<string, string> = { Electric: '⚡', Buzzing: '🔥', Chill: '😌', Dead: '💀' }
  const taglines: Record<string, string> = {
    Electric: 'The energy is unreal',
    Buzzing: 'Things are heating up',
    Chill: 'Good vibes, low key',
    Dead: 'Pretty quiet right now',
  }
  return {
    venueName: venue.name,
    category: venue.category ?? 'Venue',
    city: venue.city ?? '',
    score: venue.pulseScore,
    label,
    emoji: emojis[label] ?? '💀',
    color: ENERGY_COLORS[label] ?? ENERGY_COLORS.Dead,
    tagline: taglines[label] ?? '',
  }
}

/**
 * Create a referral invite.
 */
export function createReferralInvite(inviterId: string): ReferralInvite {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return {
    id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    inviterId,
    inviteCode: code,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
}

/**
 * Accept a referral invite.
 */
export function acceptReferralInvite(invite: ReferralInvite, acceptorUserId: string): ReferralInvite {
  return {
    ...invite,
    acceptedByUserId: acceptorUserId,
    acceptedAt: new Date().toISOString(),
    status: 'accepted',
  }
}

/**
 * Calculate referral stats for a user.
 */
export function getReferralStats(invites: ReferralInvite[], userId: string): ReferralStats {
  const userInvites = invites.filter(i => i.inviterId === userId)
  const accepted = userInvites.filter(i => i.status === 'accepted').length
  return {
    totalInvitesSent: userInvites.length,
    totalAccepted: accepted,
    conversionRate: userInvites.length > 0 ? accepted / userInvites.length : 0,
  }
}

/**
 * Generate a native share payload (for Web Share API).
 */
export function buildNativeShareData(card: ShareCard): { title: string; text: string; url: string } {
  return {
    title: card.title,
    text: card.description,
    url: card.url,
  }
}

/**
 * Copy-to-clipboard share text.
 */
export function buildClipboardShareText(card: ShareCard): string {
  return `${card.title} — ${card.description}\n${card.url}`
}
