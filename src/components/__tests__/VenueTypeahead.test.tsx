// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VenueTypeahead } from '@/components/VenueTypeahead'
import type { Venue } from '@/lib/types'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@phosphor-icons/react', () => ({
  MagnifyingGlass: () => <span />,
  MapPin: () => <span />,
  X: () => <span />,
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

describe('VenueTypeahead', () => {
  it('opens /venue via onVenueSelect when a guest types Neumos without GPS', () => {
    const onVenueSelect = vi.fn()
    render(
      <VenueTypeahead
        venues={[makeVenue(), makeVenue({ id: 'other', name: 'Barrio' })]}
        onVenueSelect={onVenueSelect}
      />,
    )
    const input = screen.getByRole('combobox', { name: /Search venues or neighborhoods/i })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'neum' } })
    fireEvent.click(screen.getByRole('option', { name: /Neumos/i }))
    expect(onVenueSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'venue-1', name: 'Neumos' }))
  })
})
