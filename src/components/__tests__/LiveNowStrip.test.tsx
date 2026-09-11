// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LiveNowStrip } from '@/components/LiveNowStrip'
import type { PulseWithUser, User, Venue } from '@/lib/types'

vi.mock('@/lib/observability/analytics', () => ({
  track: vi.fn(),
}))

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'tester',
    friends: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: { lat: 47.6, lng: -122.3, address: '1 Pike' },
    pulseScore: 40,
    ...overrides,
  }
}

function makePulse(overrides: Partial<PulseWithUser> = {}): PulseWithUser {
  return {
    id: 'p-1',
    userId: 'user-1',
    venueId: 'venue-1',
    photos: ['https://example.com/p.jpg'],
    energyRating: 'buzzing',
    caption: 'Line is moving and the room is packed',
    kind: 'review',
    hasBody: true,
    locationVerified: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    user: makeUser(),
    venue: makeVenue(),
    ...overrides,
  }
}

describe('LiveNowStrip', () => {
  it('shows an honest empty state when there are no live reviews', () => {
    render(
      <LiveNowStrip venueId="venue-1" pulses={[]} onSelect={vi.fn()} />,
    )
    expect(screen.getByText('Live now')).toBeInTheDocument()
    expect(screen.getByText(/No live reviews in the last 90 minutes/)).toBeInTheDocument()
  })

  it('shows energy, snippet, and opens the full review on tap', () => {
    const onSelect = vi.fn()
    const pulse = makePulse()
    render(<LiveNowStrip venueId="venue-1" pulses={[pulse]} onSelect={onSelect} />)
    expect(screen.getByText('Live now')).toBeInTheDocument()
    expect(screen.getByText(/Line is moving/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Line is moving/ }))
    expect(onSelect).toHaveBeenCalledWith(pulse)
  })

  it('marks unverified reviews', () => {
    render(
      <LiveNowStrip
        venueId="venue-1"
        pulses={[makePulse({ locationVerified: false })]}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('Unverified')).toBeInTheDocument()
  })
})
