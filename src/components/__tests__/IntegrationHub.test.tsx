// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IntegrationHub } from '../IntegrationHub'
import type { Pulse, User, Venue } from '@/lib/types'

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast,
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neumos',
    location: {
      lat: 47.6145,
      lng: -122.3205,
      address: '925 E Pike St, Seattle, WA',
    },
    city: 'Seattle',
    state: 'WA',
    pulseScore: 85,
    category: 'Music Venue',
    integrations: {
      music: {
        spotifyUrl: 'https://open.spotify.com/search/Neumos%20Seattle',
        playlistName: 'Capitol Hill After Dark',
      },
    },
    ...overrides,
  }
}

const currentUser: User = {
  id: 'user-1',
  username: 'kyle',
  friends: ['friend-1'],
  createdAt: new Date().toISOString(),
}

describe('IntegrationHub', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    toast.success.mockReset()
    toast.error.mockReset()
    toast.info.mockReset()
  })

  it('opens maps links from the integration hub', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)

    render(
      <IntegrationHub
        venue={makeVenue()}
        userLocation={{ lat: 47.61, lng: -122.32 }}
        venues={[makeVenue()]}
        currentUser={currentUser}
        pulses={[]}
        onBack={() => {}}
        onVenueClick={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Open in Maps'))

    expect(openSpy).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Opening maps...')
  })

  it('shows a helpful toast when no friend activity is available', () => {
    const onVenueClick = vi.fn()
    const pulses: Pulse[] = []

    render(
      <IntegrationHub
        venue={makeVenue()}
        userLocation={{ lat: 47.61, lng: -122.32 }}
        venues={[makeVenue(), makeVenue({ id: 'venue-2', name: 'Q Nightclub', pulseScore: 92, category: 'Nightclub' })]}
        currentUser={currentUser}
        pulses={pulses}
        onBack={() => {}}
        onVenueClick={onVenueClick}
      />
    )

    fireEvent.click(screen.getByText('Where are my friends?'))

    expect(onVenueClick).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('No recent friend activity yet')
  })

  it('renders venue-specific playlist metadata instead of the old demo copy', () => {
    render(
      <IntegrationHub
        venue={makeVenue()}
        userLocation={{ lat: 47.61, lng: -122.32 }}
        venues={[makeVenue()]}
        currentUser={currentUser}
        pulses={[]}
        onBack={() => {}}
        onVenueClick={() => {}}
      />
    )

    expect(screen.getByText('Capitol Hill After Dark')).toBeTruthy()
    expect(screen.queryByText('Midnight City')).toBeNull()
  })
})
