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
    expect(screen.getByRole('heading', { name: /Tonight’s queue/ })).toBeInTheDocument()
    expect(screen.getByText(/The Showbox · owner inbox/)).toBeInTheDocument()
    expect(screen.getByText(/Claim needed/)).toBeInTheDocument()
    expect(screen.getByText(/verified venue claim or a venue_staff row/)).toBeInTheDocument()
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
    expect(screen.getByText(/Tonight’s queue/)).toBeInTheDocument()
    expect(screen.getByText(/Reviews/)).toBeInTheDocument()
    expect(screen.getByText(/Reports/)).toBeInTheDocument()
    expect(screen.getByText(/DJ just started/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument()
  })

  it('keeps tonight reviews hidden while a claim is only pending', () => {
    const claims: VenueClaim[] = [{
      id: 'c1',
      venueId: 'venue-1',
      claimantUserId: 'owner-1',
      businessName: 'Showbox',
      businessEmail: 'a@b.com',
      verificationMethod: 'email',
      status: 'pending',
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
    expect(screen.getByText(/Your claim is pending review/)).toBeInTheDocument()
    expect(screen.queryByText(/DJ just started/)).not.toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Work email/i)).toBeInTheDocument()
  })

  it('lets a pending claimant confirm a work email without unlocking inbox', () => {
    const onSubmitClaim = vi.fn()
    const claims: VenueClaim[] = [{
      id: 'c1',
      venueId: 'venue-1',
      claimantUserId: 'owner-1',
      businessName: 'Showbox',
      businessEmail: '',
      verificationMethod: 'email',
      status: 'pending',
      createdAt: new Date().toISOString(),
      evidence: 'I manage the door Friday nights',
    }]
    render(
      <VenueInboxPage
        venue={makeVenue()}
        pulses={[makePulse()]}
        currentUser={makeUser()}
        claims={claims}
        onBack={vi.fn()}
        onSubmitClaim={onSubmitClaim}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Work email/i), {
      target: { value: 'gm@showboxpresents.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirm work email/i }))
    expect(onSubmitClaim).toHaveBeenCalledWith({
      evidence: 'I manage the door Friday nights',
      notes: '',
      workEmail: 'gm@showboxpresents.com',
    })
    expect(screen.queryByText(/DJ just started/)).not.toBeInTheDocument()
  })

  it('lets a signed-in user submit a claim from the empty state', () => {
    const onSubmitClaim = vi.fn()
    render(
      <VenueInboxPage
        venue={makeVenue()}
        pulses={[makePulse()]}
        currentUser={makeUser()}
        onBack={vi.fn()}
        onSubmitClaim={onSubmitClaim}
      />,
    )
    fireEvent.change(screen.getByLabelText(/How are you connected/i), {
      target: { value: 'I manage the door Friday nights' },
    })
    fireEvent.change(screen.getByLabelText(/Work email/i), {
      target: { value: 'door@neumos.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit claim/i }))
    expect(onSubmitClaim).toHaveBeenCalledWith({
      evidence: 'I manage the door Friday nights',
      notes: '',
      workEmail: 'door@neumos.com',
    })
  })

  it('lets a verified owner reply and dismiss a report', () => {
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
    const onDismissReports = vi.fn()
    render(
      <VenueInboxPage
        venue={makeVenue()}
        pulses={[makePulse()]}
        currentUser={makeUser()}
        claims={claims}
        reports={[{
          id: 'r1',
          reporterId: 'u2',
          targetType: 'pulse',
          targetId: 'p-1',
          reason: 'spam',
          createdAt: new Date().toISOString(),
          status: 'pending',
        }]}
        onDismissReports={onDismissReports}
        onBack={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    fireEvent.change(screen.getByPlaceholderText(/Reply to this review/i), {
      target: { value: 'Thanks for coming' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Send reply/i }))
    expect(screen.getByText(/Reply: Thanks for coming/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Dismiss report/i }))
    expect(onDismissReports).toHaveBeenCalledWith('p-1')
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
