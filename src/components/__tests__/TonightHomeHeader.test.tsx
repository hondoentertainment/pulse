// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TonightHomeHeader } from '@/components/TonightHomeHeader'
import type { Venue } from '@/lib/types'

vi.mock('@phosphor-icons/react', () => ({
  Lightning: () => <span />,
  ChatCircle: () => <span />,
  ShareNetwork: () => <span />,
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neumos',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 80,
    neighborhood: 'Capitol Hill',
    ...overrides,
  }
}

describe('TonightHomeHeader', () => {
  it('shows X-style Tonight / Live / Map tabs and For you cards on Tonight', () => {
    const onSurfaceChange = vi.fn()
    render(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        locationDenied
        onVenueClick={vi.fn()}
        surface="tonight"
        onSurfaceChange={onSurfaceChange}
      />,
    )
    expect(screen.getByRole('heading', { name: /Tonight ·/ })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Map home views' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tonight' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Neumos')).toBeInTheDocument()
    expect(screen.getByText('@neumos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Live' }))
    expect(onSurfaceChange).toHaveBeenCalledWith('live')
  })

  it('hides For you cards on the Map surface', () => {
    render(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        onVenueClick={vi.fn()}
        surface="map"
        onSurfaceChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('@neumos')).not.toBeInTheDocument()
  })
})
