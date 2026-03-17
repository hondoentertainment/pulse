// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VenueEnergyTimeline } from '../VenueEnergyTimeline'
import type { Venue } from '@/lib/types'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

// Mock Recharts to avoid rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: ({ label }: { label?: { value?: string } }) => (
    <div data-testid={`reference-line-${label?.value ?? 'unknown'}`} />
  ),
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-test-1',
    name: 'Test Bar',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    pulseScore: 75,
    category: 'Bar',
    ...overrides,
  }
}

describe('VenueEnergyTimeline', () => {
  it('renders in full mode with history data', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    expect(screen.getByTestId('energy-timeline-full')).toBeTruthy()
    expect(screen.getByText('Energy Timeline')).toBeTruthy()
  })

  it('renders the current time marker', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    expect(screen.getByTestId('reference-line-Now')).toBeTruthy()
  })

  it('renders the peak hour marker', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    expect(screen.getByTestId('reference-line-Peak')).toBeTruthy()
  })

  it('displays the trend badge', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    const trendBadge = screen.getByTestId('trend-badge')
    expect(trendBadge).toBeTruthy()
    // Should contain one of the trend labels
    const text = trendBadge.textContent ?? ''
    expect(['Rising', 'Winding down', 'Peaking', 'Quiet'].some(t => text.includes(t))).toBe(true)
  })

  it('displays the week comparison badge', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    const weekBadge = screen.getByTestId('week-comparison')
    expect(weekBadge).toBeTruthy()
    const text = weekBadge.textContent ?? ''
    expect(text).toMatch(/(busier|quieter|Same)/)
  })

  it('renders in compact mode without labels', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} compact />)

    expect(screen.getByTestId('energy-timeline-compact')).toBeTruthy()
    // Compact mode should not have the header text
    expect(screen.queryByText('Energy Timeline')).toBeNull()
  })

  it('shows best time to visit in footer', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    expect(screen.getByText('Best time:')).toBeTruthy()
  })

  it('shows current score in footer', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    expect(screen.getByText('Current:')).toBeTruthy()
  })

  it('renders the Recharts area chart', () => {
    const venue = makeVenue()
    render(<VenueEnergyTimeline venue={venue} />)

    expect(screen.getByTestId('area-chart')).toBeTruthy()
  })

  it('renders for different venue categories', () => {
    const categories = ['Nightclub', 'Restaurant', 'Coffee', 'Bar']
    for (const category of categories) {
      const venue = makeVenue({ id: `venue-${category}`, category })
      const { unmount } = render(<VenueEnergyTimeline venue={venue} />)
      expect(screen.getByTestId('energy-timeline-full')).toBeTruthy()
      unmount()
    }
  })
})
