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
    inventorySource: 'curated-seed',
    seeded: true,
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
    expect(screen.getByRole('tablist', { name: 'Tonight feeds' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'For you' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Following' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Near' })).toBeInTheDocument()
    expect(screen.getByText('Start here')).toBeInTheDocument()
    expect(screen.getByText('Neumos')).toBeInTheDocument()
    expect(screen.getByText('@neumos')).toBeInTheDocument()
    expect(screen.queryByText('Quiet nearby — no live reviews in the last hour.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Live' }))
    expect(onSurfaceChange).toHaveBeenCalledWith('live')
  })

  it('keeps Following honestly empty and Near on Launch 33 without geo', () => {
    render(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        locationDenied
        onVenueClick={vi.fn()}
        surface="tonight"
        onSurfaceChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Following' }))
    expect(screen.getByText('Nothing in Following yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Near' }))
    expect(screen.getByText('Launch 33 · location off')).toBeInTheDocument()
    expect(screen.getByText('Neumos')).toBeInTheDocument()
    expect(screen.getByText('@neumos')).toBeInTheDocument()
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
