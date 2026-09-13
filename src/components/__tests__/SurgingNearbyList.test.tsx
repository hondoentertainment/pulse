// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SurgingNearbyList } from '@/components/SurgingNearbyList'
import { EMPTY_SURGING_CTA, EMPTY_SURGING_START_HERE } from '@/lib/empty-surging'
import type { Pulse, Venue } from '@/lib/types'

vi.mock('@phosphor-icons/react', () => ({
  Lightning: () => <span />,
  ChatCircle: () => <span />,
  ShareNetwork: () => <span />,
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 88,
    neighborhood: 'Capitol Hill',
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p-1',
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'electric',
    caption: 'DJ just switched — floor is packed.',
    kind: 'review',
    hasBody: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('SurgingNearbyList', () => {
  it('shows a quiet state when there are no live reviews', () => {
    const onVenueClick = vi.fn()
    const onBeFirstPulse = vi.fn()
    const venue = makeVenue()
    render(
      <SurgingNearbyList
        venues={[venue]}
        pulses={[]}
        userLocation={null}
        unitSystem="imperial"
        onVenueClick={onVenueClick}
        onBeFirstPulse={onBeFirstPulse}
      />,
    )
    expect(screen.getByText('Surging nearby')).toBeInTheDocument()
    expect(screen.getByText(/Quiet nearby — no live reviews in the last hour/)).toBeInTheDocument()
    expect(screen.getByText(EMPTY_SURGING_START_HERE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Neon Lounge' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: EMPTY_SURGING_CTA }))
    expect(onBeFirstPulse).toHaveBeenCalledWith(venue)
  })

  it('lists real last-hour review counts and opens the venue', () => {
    const onVenueClick = vi.fn()
    const venue = makeVenue()
    render(
      <SurgingNearbyList
        venues={[venue]}
        pulses={[makePulse({ id: 'a' }), makePulse({ id: 'b' })]}
        userLocation={null}
        unitSystem="imperial"
        onVenueClick={onVenueClick}
      />,
    )
    expect(screen.getByText('Surging nearby')).toBeInTheDocument()
    expect(screen.getByText('Neon Lounge')).toBeInTheDocument()
    expect(screen.getByText('DJ just switched — floor is packed.')).toBeInTheDocument()
    expect(screen.getByText('Electric')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Trust at a glance' })).toBeInTheDocument()
    expect(screen.getByText('Just now')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /DJ just switched/i }))
    expect(onVenueClick).toHaveBeenCalledWith(venue)
  })
})
