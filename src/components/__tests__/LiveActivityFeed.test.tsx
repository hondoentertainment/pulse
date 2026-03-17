// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Venue } from '@/lib/types'
import type { ActivityEvent } from '@/lib/live-activity-feed'

// Mock the hook before importing the component
const mockUseLiveActivityFeed = vi.fn()

vi.mock('@/hooks/use-live-activity-feed', () => ({
  useLiveActivityFeed: (...args: unknown[]) => mockUseLiveActivityFeed(...args),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

vi.mock('@phosphor-icons/react', () => ({
  MapPin: () => <span data-testid="icon-mappin" />,
  Lightning: () => <span data-testid="icon-lightning" />,
  MusicNote: () => <span data-testid="icon-musicnote" />,
  TrendUp: () => <span data-testid="icon-trendup" />,
  Beer: () => <span data-testid="icon-beer" />,
}))

import { LiveActivityFeed } from '../LiveActivityFeed'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 47.6, lng: -122.3, address: '123 Main St' },
    pulseScore: 50,
    ...overrides,
  }
}

function makeActivityEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: `laf_${Math.random().toString(36).slice(2, 7)}`,
    type: 'checkin',
    venueId: 'venue-1',
    venueName: 'Neon Lounge',
    timestamp: Date.now(),
    message: '3 people just checked in at Neon Lounge',
    priority: 2,
    ...overrides,
  }
}

const defaultHookReturn = {
  events: [] as ActivityEvent[],
  latestEvent: null,
  isLive: true,
  pauseFeed: vi.fn(),
  resumeFeed: vi.fn(),
}

describe('LiveActivityFeed', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockUseLiveActivityFeed.mockReturnValue({ ...defaultHookReturn })
  })

  it('renders empty state when no events', () => {
    render(<LiveActivityFeed venues={[makeVenue()]} />)
    expect(screen.getByText(/No activity nearby/)).toBeDefined()
  })

  it('renders events when present', () => {
    const event = makeActivityEvent({ message: '5 people just checked in at Neon Lounge' })
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultHookReturn,
      events: [event],
      latestEvent: event,
    })

    render(<LiveActivityFeed venues={[makeVenue()]} />)
    expect(screen.getByText('5 people just checked in at Neon Lounge')).toBeDefined()
  })

  it('renders live indicator when feed is live', () => {
    const event = makeActivityEvent()
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultHookReturn,
      events: [event],
      isLive: true,
    })

    render(<LiveActivityFeed venues={[makeVenue()]} />)
    const indicator = screen.getByTestId('live-indicator')
    expect(indicator.className).toContain('bg-green-500')
    expect(screen.getByText('Live')).toBeDefined()
  })

  it('renders paused indicator when feed is paused', () => {
    const event = makeActivityEvent()
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultHookReturn,
      events: [event],
      isLive: false,
    })

    render(<LiveActivityFeed venues={[makeVenue()]} />)
    const indicator = screen.getByTestId('live-indicator')
    expect(indicator.className).toContain('bg-gray-400')
    expect(screen.getByText('Paused')).toBeDefined()
  })

  it('calls onVenueTap when tapping an event', () => {
    const onVenueTap = vi.fn()
    const event = makeActivityEvent({ venueId: 'venue-42' })
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultHookReturn,
      events: [event],
      latestEvent: event,
    })

    render(<LiveActivityFeed venues={[makeVenue()]} onVenueTap={onVenueTap} />)
    fireEvent.click(screen.getByText(event.message))
    expect(onVenueTap).toHaveBeenCalledWith('venue-42')
  })

  it('renders multiple events', () => {
    const events = [
      makeActivityEvent({ id: 'e1', message: 'Event one' }),
      makeActivityEvent({ id: 'e2', message: 'Event two' }),
      makeActivityEvent({ id: 'e3', message: 'Event three' }),
    ]
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultHookReturn,
      events,
      latestEvent: events[2],
    })

    render(<LiveActivityFeed venues={[makeVenue()]} />)
    expect(screen.getByText('Event one')).toBeDefined()
    expect(screen.getByText('Event two')).toBeDefined()
    expect(screen.getByText('Event three')).toBeDefined()
  })

  it('shows correct icon for different event types', () => {
    const events = [
      makeActivityEvent({ id: 'e1', type: 'checkin', message: 'Checkin event' }),
      makeActivityEvent({ id: 'e2', type: 'surge', message: 'Surge event' }),
      makeActivityEvent({ id: 'e3', type: 'event_starting', message: 'Starting event' }),
    ]
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultHookReturn,
      events,
    })

    render(<LiveActivityFeed venues={[makeVenue()]} />)
    expect(screen.getAllByTestId('icon-mappin').length).toBe(1)
    expect(screen.getAllByTestId('icon-lightning').length).toBe(1)
    expect(screen.getAllByTestId('icon-musicnote').length).toBe(1)
  })

  it('renders in expanded mode when compact is false', () => {
    const event = makeActivityEvent({ venueName: 'Neon Lounge', message: 'Expanded message' })
    mockUseLiveActivityFeed.mockReturnValue({
      ...defaultHookReturn,
      events: [event],
    })

    render(<LiveActivityFeed venues={[makeVenue()]} compact={false} />)
    // In expanded mode, venue name is rendered separately as a heading
    expect(screen.getByText('Neon Lounge')).toBeDefined()
    expect(screen.getByText('Expanded message')).toBeDefined()
  })
})
