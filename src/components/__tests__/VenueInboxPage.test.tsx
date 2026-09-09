// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VenueInboxPage } from '@/components/VenueInboxPage'
import type { Pulse, User, Venue } from '@/lib/types'
import type { VenueClaim } from '@/lib/venue-owner'

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: () => true,
}))

vi.mock('@/lib/observability/analytics', () => ({
  track: vi.fn(),
}))

function makeVenue(): Venue {
  return {
    id: 'venue-1',
    name: 'The Showbox',
    location: { lat: 47.6, lng: -122.3, address: '1 Pike' },
    pulseScore: 55,
  }
}

function makeUser(): User {
  return {
    id: 'owner-1',
    username: 'owner',
    friends: [],
    createdAt: new Date().toISOString(),
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p-1',
    userId: 'patron-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'electric',
    caption: 'DJ just started',
    kind: 'review',
    hasBody: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('VenueInboxPage', () => {
  it('shows claim-needed when the user does not own the venue', () => {
    render(
      <VenueInboxPage
        venue={makeVenue()}
        pulses={[makePulse()]}
        currentUser={makeUser()}
        onBack={vi.fn()}
      />,
    )
    expect(screen.getByText(/Tonight’s reviews/)).toBeInTheDocument()
    expect(screen.getByText(/The Showbox · owner inbox/)).toBeInTheDocument()
    expect(screen.getByText(/Empty state until claim \/ venue_staff verified/)).toBeInTheDocument()
  })

  it('lists tonight reviews for a verified claimant', () => {
    const claims: VenueClaim[] = [{
      id: 'c1',
      venueId: 'venue-1',
      claimantUserId: 'owner-1',
      businessName: 'Showbox',
      businessEmail: 'a@b.com',
      verificationMethod: 'email',
      status: 'verified',
      createdAt: new Date().toISOString(),
    }]
    render(
      <VenueInboxPage
        venue={makeVenue()}
        pulses={[makePulse()]}
        currentUser={makeUser()}
        claims={claims}
        onBack={vi.fn()}
      />,
    )
    expect(screen.getByText(/Tonight’s reviews/)).toBeInTheDocument()
    expect(screen.getByText(/Live reviews/)).toBeInTheDocument()
    expect(screen.getByText(/Avg energy/)).toBeInTheDocument()
    expect(screen.getByText(/DJ just started/)).toBeInTheDocument()
  })

  it('calls onBack', () => {
    const onBack = vi.fn()
    render(
      <VenueInboxPage
        venue={makeVenue()}
        pulses={[]}
        currentUser={makeUser()}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
