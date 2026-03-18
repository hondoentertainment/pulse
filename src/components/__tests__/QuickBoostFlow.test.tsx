// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QuickBoostFlow } from '../QuickBoostFlow'
import type { Venue } from '@/lib/types'
import type { ActiveBoost, BoostType } from '@/lib/venue-quick-boost'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    h2: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'The Neon Lounge',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    pulseScore: 70,
    category: 'Nightclub',
    ...overrides,
  }
}

function makeBoost(): ActiveBoost {
  return {
    id: 'qboost-test-1',
    venueId: 'venue-1',
    type: 'happy_hour',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    status: 'active',
    impressions: 0,
    taps: 0,
    conversions: 0,
  }
}

describe('QuickBoostFlow', () => {
  const defaultProps = {
    venue: makeVenue(),
    recommendedType: 'happy_hour' as BoostType,
    canBoost: true,
    onCreateBoost: vi.fn(() => makeBoost()),
    onBack: vi.fn(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    defaultProps.onCreateBoost = vi.fn(() => makeBoost())
    defaultProps.onBack = vi.fn()
  })

  it('renders step 1 with all 6 boost type options', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    expect(screen.getByText('Choose Boost Type')).toBeTruthy()
    expect(screen.getByText('Happy Hour')).toBeTruthy()
    expect(screen.getByText('Live Music')).toBeTruthy()
    expect(screen.getByText('Special Event')).toBeTruthy()
    expect(screen.getByText('Last Call')).toBeTruthy()
    expect(screen.getByText('Grand Opening')).toBeTruthy()
    expect(screen.getByText('Featured')).toBeTruthy()
  })

  it('shows "Suggested" badge on recommended type', () => {
    render(<QuickBoostFlow {...defaultProps} recommendedType="live_music" />)
    expect(screen.getByText('Suggested')).toBeTruthy()
  })

  it('shows progress dots for step tracking', () => {
    const { container } = render(<QuickBoostFlow {...defaultProps} />)
    // 3 progress dots
    const dots = container.querySelectorAll('.rounded-full.transition-all')
    expect(dots.length).toBe(3)
  })

  it('advances to step 2 when a type is selected', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    fireEvent.click(screen.getByText('Happy Hour'))

    expect(screen.getByText('Select Duration')).toBeTruthy()
  })

  it('shows duration options on step 2', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    fireEvent.click(screen.getByText('Happy Hour'))

    expect(screen.getByText('30 minutes')).toBeTruthy()
    expect(screen.getByText('1 hour')).toBeTruthy()
    expect(screen.getByText('2 hours')).toBeTruthy()
    expect(screen.getByText('4 hours')).toBeTruthy()
  })

  it('advances to step 3 confirmation when duration is selected', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    fireEvent.click(screen.getByText('Happy Hour'))
    fireEvent.click(screen.getByText('1 hour'))

    expect(screen.getByText('Confirm Boost')).toBeTruthy()
    expect(screen.getByText('Happy Hour')).toBeTruthy()
    expect(screen.getByText('Immediately')).toBeTruthy()
  })

  it('shows estimated impressions on step 3', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    fireEvent.click(screen.getByText('Happy Hour'))
    fireEvent.click(screen.getByText('1 hour'))

    expect(screen.getByText('Est. Impressions')).toBeTruthy()
  })

  it('calls onCreateBoost when Boost Now is clicked', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    fireEvent.click(screen.getByText('Happy Hour'))
    fireEvent.click(screen.getByText('1 hour'))
    fireEvent.click(screen.getByText('Boost Now'))

    expect(defaultProps.onCreateBoost).toHaveBeenCalledWith('venue-1', 'happy_hour', 60)
  })

  it('shows success state after boost creation', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    fireEvent.click(screen.getByText('Happy Hour'))
    fireEvent.click(screen.getByText('1 hour'))
    fireEvent.click(screen.getByText('Boost Now'))

    expect(screen.getByText('Your venue is now boosted!')).toBeTruthy()
    expect(screen.getByText('Live Impressions')).toBeTruthy()
    expect(screen.getByText('Back to Dashboard')).toBeTruthy()
  })

  it('calls onBack when back button is clicked on step 1', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    // Find the back button (ArrowLeft)
    const backButtons = screen.getAllByRole('button')
    fireEvent.click(backButtons[0]) // first button is the back button

    expect(defaultProps.onBack).toHaveBeenCalled()
  })

  it('goes back to step 1 when back is clicked on step 2', () => {
    render(<QuickBoostFlow {...defaultProps} />)

    fireEvent.click(screen.getByText('Happy Hour'))
    expect(screen.getByText('Select Duration')).toBeTruthy()

    // Click back
    const backButtons = screen.getAllByRole('button')
    fireEvent.click(backButtons[0])

    expect(screen.getByText('Choose Boost Type')).toBeTruthy()
  })

  it('shows disabled state when canBoost is false', () => {
    render(<QuickBoostFlow {...defaultProps} canBoost={false} />)

    expect(screen.getByText(/Maximum 2 active boosts/)).toBeTruthy()
  })

  it('does not call onCreateBoost when canBoost returns null', () => {
    const onCreateBoost = vi.fn(() => null)
    render(<QuickBoostFlow {...defaultProps} onCreateBoost={onCreateBoost} />)

    fireEvent.click(screen.getByText('Featured'))
    fireEvent.click(screen.getByText('1 hour'))
    fireEvent.click(screen.getByText('Boost Now'))

    expect(onCreateBoost).toHaveBeenCalled()
    // Should not transition to success state
    expect(screen.queryByText('Your venue is now boosted!')).toBeNull()
  })
})
