// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TonightHomeHeader } from '@/components/TonightHomeHeader'
import type { Venue } from '@/lib/types'

function renderTonight(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@phosphor-icons/react', () => ({
  Lightning: () => <span />,
  ChatCircle: () => <span />,
  ShareNetwork: () => <span />,
  MagnifyingGlass: () => <span />,
  MapPin: () => <span />,
  X: () => <span />,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    renderTonight(
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
    expect(screen.getByText(/Launch 33 fallback/)).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Map home views' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tonight' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tablist', { name: 'Tonight feeds' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'For you' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Following' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Near' })).toBeInTheDocument()
    expect(screen.getByText('Start here')).toBeInTheDocument()
    expect(screen.getAllByText('Neumos').length).toBeGreaterThan(0)
    expect(screen.getByText('@neumos')).toBeInTheDocument()
    expect(screen.getByText('Quiet nearby — no live reviews in the last hour.')).toBeInTheDocument()
    expect(screen.getByLabelText('Teach the Pulse loop')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Live' }))
    expect(onSurfaceChange).toHaveBeenCalledWith('live')
  })

  it('lets a guest search Neumos from Tonight and open the venue', () => {
    const onVenueClick = vi.fn()
    renderTonight(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        locationDenied
        onVenueClick={onVenueClick}
        surface="tonight"
        onSurfaceChange={vi.fn()}
      />,
    )
    const input = screen.getByRole('combobox', { name: /Search venues or neighborhoods/i })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'neum' } })
    fireEvent.click(screen.getByRole('option'))
    expect(onVenueClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Neumos' }))
  })

  it('follows from a Tonight row and sends guests to /auth', () => {
    const onFollowAuth = vi.fn()
    const onToggleFollow = vi.fn()
    renderTonight(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        locationDenied
        onVenueClick={vi.fn()}
        onFollowAuth={onFollowAuth}
        onToggleFollow={onToggleFollow}
        surface="tonight"
        onSurfaceChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Follow venue' }))
    expect(onFollowAuth).toHaveBeenCalled()
    expect(onToggleFollow).not.toHaveBeenCalled()
  })

  it('toggles Follow on a Tonight row when signed in', () => {
    const onToggleFollow = vi.fn()
    renderTonight(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        signedIn
        onVenueClick={vi.fn()}
        onToggleFollow={onToggleFollow}
        surface="tonight"
        onSurfaceChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Follow venue' }))
    expect(onToggleFollow).toHaveBeenCalledWith('venue-1')
  })

  it('exposes Share on Tonight rows', () => {
    const onShareVenue = vi.fn()
    renderTonight(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        onVenueClick={vi.fn()}
        onShareVenue={onShareVenue}
        surface="tonight"
        onSurfaceChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(onShareVenue).toHaveBeenCalledWith(expect.objectContaining({ id: 'venue-1' }))
  })

  it('keeps guest Following as teach-the-loop and Near on Launch 33 without geo', () => {
    const onFollowAuth = vi.fn()
    renderTonight(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[]}
        userLocation={null}
        locationDenied
        onVenueClick={vi.fn()}
        onFollowAuth={onFollowAuth}
        surface="tonight"
        onSurfaceChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Following' }))
    expect(screen.getByText('Follow a venue for tonight')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))
    expect(onFollowAuth).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: 'Near' }))
    expect(screen.getByText('Launch 33 · location off')).toBeInTheDocument()
    expect(screen.getAllByText('Neumos').length).toBeGreaterThan(0)
    expect(screen.getByText('@neumos')).toBeInTheDocument()
  })

  it('lists followed venues and their latest live pulse when signed in', () => {
    renderTonight(
      <TonightHomeHeader
        venues={[makeVenue()]}
        pulses={[{
          id: 'p1',
          userId: 'u1',
          venueId: 'venue-1',
          photos: [],
          energyRating: 'electric',
          caption: 'Room is packed',
          kind: 'review',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
          reactions: { fire: [], eyes: [], skull: [], lightning: [] },
          views: 0,
        }]}
        userLocation={null}
        followedVenueIds={['venue-1']}
        signedIn
        onVenueClick={vi.fn()}
        surface="tonight"
        onSurfaceChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Following' }))
    expect(screen.getByText('Neumos')).toBeInTheDocument()
    expect(screen.getByText('Room is packed')).toBeInTheDocument()
    expect(screen.queryByText('Follow a venue for tonight')).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing in Following yet')).not.toBeInTheDocument()
  })

  it('hides For you cards on the Map surface', () => {
    renderTonight(
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
