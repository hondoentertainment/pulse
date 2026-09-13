// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LivePulseTimeline } from '@/components/LivePulseTimeline'
import { EMPTY_SURGING_CTA } from '@/lib/empty-surging'
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
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 70,
    neighborhood: 'Capitol Hill',
    inventorySource: 'curated-seed',
    seeded: true,
  }
}

describe('LivePulseTimeline', () => {
  it('renders an honest empty timeline', () => {
    const onBeFirstPulse = vi.fn()
    const venue = makeVenue()
    render(
      <LivePulseTimeline
        pulses={[]}
        venues={[venue]}
        onVenueClick={vi.fn()}
        onBeFirstPulse={onBeFirstPulse}
      />,
    )
    expect(screen.getByText(/Quiet nearby — no live reviews in the last hour/)).toBeInTheDocument()
    expect(screen.getByText('Start here')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: EMPTY_SURGING_CTA }))
    expect(onBeFirstPulse).toHaveBeenCalledWith(venue)
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
    expect(screen.getByText('@tester')).toBeInTheDocument()
    expect(screen.getByText(/Floor is packed/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Floor is packed/ }))
    expect(onVenueClick).toHaveBeenCalledWith(venue)
  })
})
