// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LivePulseTimeline } from '@/components/LivePulseTimeline'
import type { PulseWithUser, User, Venue } from '@/lib/types'

vi.mock('@phosphor-icons/react', () => ({
  Lightning: () => <span />,
  ChatCircle: () => <span />,
  ShareNetwork: () => <span />,
}))

function makeUser(): User {
  return { id: 'user-1', username: 'tester', friends: [], createdAt: new Date().toISOString() }
}

function makeVenue(): Venue {
  return {
    id: 'venue-1',
    name: 'Neumos',
    location: { lat: 47.6, lng: -122.3, address: '1 Pike' },
    pulseScore: 70,
  }
}

describe('LivePulseTimeline', () => {
  it('renders an honest empty timeline', () => {
    render(<LivePulseTimeline pulses={[]} venues={[makeVenue()]} onVenueClick={vi.fn()} />)
    expect(screen.getByText(/Quiet nearby — no live reviews in the last hour/)).toBeInTheDocument()
  })

  it('lists live pulses as an X timeline and opens the venue', () => {
    const onVenueClick = vi.fn()
    const venue = makeVenue()
    const pulse: PulseWithUser = {
      id: 'p-1',
      userId: 'user-1',
      venueId: venue.id,
      photos: [],
      energyRating: 'electric',
      caption: 'Floor is packed',
      kind: 'review',
      hasBody: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      reactions: { fire: [], eyes: [], skull: [], lightning: [] },
      views: 0,
      user: makeUser(),
      venue,
    }
    render(<LivePulseTimeline pulses={[pulse]} venues={[venue]} onVenueClick={onVenueClick} />)
    expect(screen.getByText('tester')).toBeInTheDocument()
    expect(screen.getByText('@neumos')).toBeInTheDocument()
    expect(screen.getByText(/Floor is packed/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Floor is packed/ }))
    expect(onVenueClick).toHaveBeenCalledWith(venue)
  })
})
