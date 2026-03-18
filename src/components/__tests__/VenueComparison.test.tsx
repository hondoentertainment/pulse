// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VenueComparison } from '../VenueComparison'
import { compareVenues } from '@/lib/venue-comparison'
import type { Venue } from '@/lib/types'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
    pulseScore: 80,
    category: 'Nightclub',
    scoreVelocity: 10,
    ...overrides,
  }
}

const venueA = makeVenue({ id: 'a', name: 'Neon Lounge', pulseScore: 80, category: 'Nightclub' })
const venueB = makeVenue({ id: 'b', name: 'The Rooftop', pulseScore: 55, category: 'Bar' })

describe('VenueComparison', () => {
  const defaultProps = {
    onRemoveVenue: vi.fn(),
    onSwapVenues: vi.fn(),
    onClear: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no venues selected', () => {
    render(
      <VenueComparison
        selectedVenues={[null, null]}
        comparisonResult={null}
        {...defaultProps}
      />
    )

    expect(screen.getByTestId('comparison-empty')).toBeTruthy()
    expect(screen.getByText('Select two venues to compare')).toBeTruthy()
  })

  it('renders partial state with one venue', () => {
    render(
      <VenueComparison
        selectedVenues={[venueA, null]}
        comparisonResult={null}
        {...defaultProps}
      />
    )

    expect(screen.getByText('Neon Lounge')).toBeTruthy()
    expect(screen.getByText('Pick venue 2')).toBeTruthy()
  })

  it('renders two venues with comparison metrics', () => {
    const result = compareVenues(venueA, venueB)

    render(
      <VenueComparison
        selectedVenues={[venueA, venueB]}
        comparisonResult={result}
        {...defaultProps}
      />
    )

    expect(screen.getByTestId('venue-comparison')).toBeTruthy()
    expect(screen.getByText('Neon Lounge')).toBeTruthy()
    expect(screen.getByText('The Rooftop')).toBeTruthy()
    expect(screen.getByTestId('comparison-verdict')).toBeTruthy()
  })

  it('calls onSwapVenues when swap button clicked', () => {
    const result = compareVenues(venueA, venueB)

    render(
      <VenueComparison
        selectedVenues={[venueA, venueB]}
        comparisonResult={result}
        {...defaultProps}
      />
    )

    const swapButton = screen.getByLabelText('Swap venues')
    fireEvent.click(swapButton)
    expect(defaultProps.onSwapVenues).toHaveBeenCalledTimes(1)
  })

  it('calls onClear when clear button clicked', () => {
    const result = compareVenues(venueA, venueB)

    render(
      <VenueComparison
        selectedVenues={[venueA, venueB]}
        comparisonResult={result}
        {...defaultProps}
      />
    )

    const clearButton = screen.getByLabelText('Clear comparison')
    fireEvent.click(clearButton)
    expect(defaultProps.onClear).toHaveBeenCalledTimes(1)
  })

  it('calls onRemoveVenue when remove button clicked on a card', () => {
    const result = compareVenues(venueA, venueB)

    render(
      <VenueComparison
        selectedVenues={[venueA, venueB]}
        comparisonResult={result}
        {...defaultProps}
      />
    )

    const removeButton = screen.getByLabelText('Remove Neon Lounge')
    fireEvent.click(removeButton)
    expect(defaultProps.onRemoveVenue).toHaveBeenCalledWith(0)
  })

  it('shows "pick for me" buttons and displays verdict', () => {
    const result = compareVenues(venueA, venueB)

    render(
      <VenueComparison
        selectedVenues={[venueA, venueB]}
        comparisonResult={result}
        {...defaultProps}
      />
    )

    expect(screen.getByTestId('pick-energy')).toBeTruthy()
    expect(screen.getByTestId('pick-proximity')).toBeTruthy()
    expect(screen.getByTestId('pick-social')).toBeTruthy()
    expect(screen.getByTestId('pick-price')).toBeTruthy()

    // Click energy pick
    fireEvent.click(screen.getByTestId('pick-energy'))
    // Should show a pick result (venueA has higher energy)
    expect(screen.getByTestId('pick-result')).toBeTruthy()
    expect(screen.getByTestId('pick-result').textContent).toContain('Neon Lounge')
  })

  it('toggles pick for me off when clicked again', () => {
    const result = compareVenues(venueA, venueB)

    render(
      <VenueComparison
        selectedVenues={[venueA, venueB]}
        comparisonResult={result}
        {...defaultProps}
      />
    )

    const energyBtn = screen.getByTestId('pick-energy')
    fireEvent.click(energyBtn)
    expect(screen.getByTestId('pick-result')).toBeTruthy()

    // Click again to deselect
    fireEvent.click(energyBtn)
    expect(screen.queryByTestId('pick-result')).toBeNull()
  })

  it('shows tie message for equal venues', () => {
    const v1 = makeVenue({ id: 'x', name: 'Alpha', pulseScore: 60, category: 'Bar' })
    const v2 = makeVenue({ id: 'y', name: 'Beta', pulseScore: 60, category: 'Bar' })
    const result = compareVenues(v1, v2)

    render(
      <VenueComparison
        selectedVenues={[v1, v2]}
        comparisonResult={result}
        {...defaultProps}
      />
    )

    // Energy is tied
    fireEvent.click(screen.getByTestId('pick-energy'))
    expect(screen.getByTestId('pick-result').textContent).toContain('tie')
  })
})
