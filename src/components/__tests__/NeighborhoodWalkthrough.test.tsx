// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NeighborhoodWalkthrough } from '../NeighborhoodWalkthrough'
import type { WalkthroughRoute, WalkthroughStop, WalkthroughTheme } from '@/lib/neighborhood-walkthrough'
import type { Venue } from '@/lib/types'

const { IconStub } = vi.hoisted(() => {
  const IconStub = (_props: Record<string, unknown>) => null
  return { IconStub }
})

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}))

vi.mock('@phosphor-icons/react', () => ({
  MapPin: IconStub,
  NavigationArrow: IconStub,
  Play: IconStub,
  Check: IconStub,
  X: IconStub,
  MusicNote: IconStub,
  Wine: IconStub,
  ForkKnife: IconStub,
  Fire: IconStub,
  Star: IconStub,
  Question: IconStub,
}))

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'The Hotspot',
    location: { lat: 47.6145, lng: -122.3205, address: '123 Main St' },
    city: 'Seattle',
    state: 'WA',
    pulseScore: 85,
    category: 'bar',
    ...overrides,
  }
}

function makeStop(order: number, venue: Venue, walkTime: number = 5): WalkthroughStop {
  return {
    venue,
    order,
    walkTimeFromPrevious: order === 1 ? 0 : walkTime,
    estimatedArrival: new Date('2026-03-17T22:00:00'),
    energyAtArrival: 'buzzing',
    reason: `Great vibes at ${venue.name}`,
  }
}

function makeRoute(overrides: Partial<WalkthroughRoute> = {}): WalkthroughRoute {
  const v1 = makeVenue({ id: 'v1', name: 'The Hotspot' })
  const v2 = makeVenue({ id: 'v2', name: 'Cocktail Corner' })
  const v3 = makeVenue({ id: 'v3', name: 'The Dive' })

  return {
    id: 'walk-test',
    neighborhood: 'Capitol Hill',
    stops: [makeStop(1, v1), makeStop(2, v2, 8), makeStop(3, v3, 6)],
    totalWalkTime: 14,
    totalDistance: 0.7,
    venueCount: 3,
    theme: 'hottest',
    difficulty: 'easy',
    ...overrides,
  }
}

const defaultProps = {
  route: null as WalkthroughRoute | null,
  currentStopIndex: 0,
  isActive: false,
  isCompleted: false,
  estimatedCompletion: null as Date | null,
  availableThemes: ['hottest', 'cocktail-crawl', 'dive-bars', 'live-music'] as WalkthroughTheme[],
  onGenerateRoute: vi.fn(),
  onStart: vi.fn(),
  onAdvance: vi.fn(),
  onEnd: vi.fn(),
  neighborhood: 'Capitol Hill',
}

describe('NeighborhoodWalkthrough', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    defaultProps.onGenerateRoute = vi.fn()
    defaultProps.onStart = vi.fn()
    defaultProps.onAdvance = vi.fn()
    defaultProps.onEnd = vi.fn()
  })

  describe('empty state', () => {
    it('shows empty state when no route is provided', () => {
      render(<NeighborhoodWalkthrough {...defaultProps} />)

      expect(screen.getByText('Select a theme to generate a walkthrough route')).toBeTruthy()
    })

    it('renders theme selector chips', () => {
      render(<NeighborhoodWalkthrough {...defaultProps} />)

      expect(screen.getByText('Hottest')).toBeTruthy()
      expect(screen.getByText('Cocktails')).toBeTruthy()
      expect(screen.getByText('Dive Bars')).toBeTruthy()
      expect(screen.getByText('Live Music')).toBeTruthy()
    })
  })

  describe('theme selector', () => {
    it('calls onGenerateRoute when theme is selected', () => {
      render(<NeighborhoodWalkthrough {...defaultProps} />)

      fireEvent.click(screen.getByText('Cocktails'))

      expect(defaultProps.onGenerateRoute).toHaveBeenCalledWith('Capitol Hill', 'cocktail-crawl')
    })

    it('highlights the selected theme', () => {
      render(<NeighborhoodWalkthrough {...defaultProps} />)

      const hottestBtn = screen.getByRole('tab', { name: /Hottest/i })
      expect(hottestBtn.className).toContain('bg-purple-500')
    })
  })

  describe('route card', () => {
    it('renders a complete route with stop names', () => {
      const route = makeRoute()
      render(<NeighborhoodWalkthrough {...defaultProps} route={route} />)

      expect(screen.getByText('The Hotspot')).toBeTruthy()
      expect(screen.getByText('Cocktail Corner')).toBeTruthy()
      expect(screen.getByText('The Dive')).toBeTruthy()
    })

    it('displays total walk time and distance', () => {
      const route = makeRoute()
      render(<NeighborhoodWalkthrough {...defaultProps} route={route} />)

      expect(screen.getByText(/14 min walking/)).toBeTruthy()
      expect(screen.getByText(/0\.7 mi/)).toBeTruthy()
    })

    it('shows walk times between stops', () => {
      const route = makeRoute()
      render(<NeighborhoodWalkthrough {...defaultProps} route={route} />)

      expect(screen.getByText('8 min walk')).toBeTruthy()
      expect(screen.getByText('6 min walk')).toBeTruthy()
    })

    it('shows difficulty badge', () => {
      const route = makeRoute({ difficulty: 'easy' })
      render(<NeighborhoodWalkthrough {...defaultProps} route={route} />)

      expect(screen.getByText('easy')).toBeTruthy()
    })

    it('shows Start Route button', () => {
      const route = makeRoute()
      render(<NeighborhoodWalkthrough {...defaultProps} route={route} />)

      expect(screen.getByText('Start Route')).toBeTruthy()
    })

    it('calls onStart when Start Route is clicked', () => {
      const route = makeRoute()
      render(<NeighborhoodWalkthrough {...defaultProps} route={route} />)

      fireEvent.click(screen.getByText('Start Route'))
      expect(defaultProps.onStart).toHaveBeenCalledOnce()
    })
  })

  describe('in-progress view', () => {
    it('shows current stop indicator', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={0}
        />
      )

      expect(screen.getByText('Stop 1 of 3')).toBeTruthy()
      // The Hotspot appears both in the header and in the stop list
      expect(screen.getAllByText('The Hotspot').length).toBeGreaterThanOrEqual(1)
    })

    it('shows walk time to next stop', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={0}
        />
      )

      expect(screen.getByText(/8 min walk to Cocktail Corner/)).toBeTruthy()
    })

    it('shows Next Stop button', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={0}
        />
      )

      expect(screen.getByText('Next Stop')).toBeTruthy()
    })

    it('shows Finish Crawl on last stop', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={2}
        />
      )

      expect(screen.getByText('Finish Crawl')).toBeTruthy()
    })

    it('calls onAdvance when Next Stop is clicked', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={1}
        />
      )

      fireEvent.click(screen.getByText('Next Stop'))
      expect(defaultProps.onAdvance).toHaveBeenCalledOnce()
    })

    it('shows End button to cancel', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={0}
        />
      )

      expect(screen.getByText('End')).toBeTruthy()
    })

    it('calls onEnd when End is clicked', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={0}
        />
      )

      fireEvent.click(screen.getByText('End'))
      expect(defaultProps.onEnd).toHaveBeenCalledOnce()
    })

    it('shows ETA when estimatedCompletion is provided', () => {
      const route = makeRoute()
      const eta = new Date('2026-03-17T23:30:00')
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={0}
          estimatedCompletion={eta}
        />
      )

      expect(screen.getByText(/ETA:/)).toBeTruthy()
    })
  })

  describe('completed state', () => {
    it('shows completion message', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={false}
          isCompleted={true}
          currentStopIndex={3}
        />
      )

      expect(screen.getByText('Crawl complete!')).toBeTruthy()
      expect(screen.getByText(/You hit 3 spots/)).toBeTruthy()
    })

    it('shows Done button that calls onEnd', () => {
      const route = makeRoute()
      render(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={false}
          isCompleted={true}
          currentStopIndex={3}
        />
      )

      const doneBtn = screen.getByText('Done')
      expect(doneBtn).toBeTruthy()
      fireEvent.click(doneBtn)
      expect(defaultProps.onEnd).toHaveBeenCalledOnce()
    })
  })

  describe('start/advance/complete flow', () => {
    it('flows from route card to in-progress to completed', () => {
      const route = makeRoute()

      // 1. Route card state
      const { rerender } = render(
        <NeighborhoodWalkthrough {...defaultProps} route={route} />
      )
      expect(screen.getByText('Start Route')).toBeTruthy()

      // 2. Start — in-progress
      rerender(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={0}
        />
      )
      expect(screen.getByText('Stop 1 of 3')).toBeTruthy()

      // 3. Advance to stop 2
      rerender(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={1}
        />
      )
      expect(screen.getByText('Stop 2 of 3')).toBeTruthy()

      // 4. Advance to last stop
      rerender(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={true}
          currentStopIndex={2}
        />
      )
      expect(screen.getByText('Finish Crawl')).toBeTruthy()

      // 5. Complete
      rerender(
        <NeighborhoodWalkthrough
          {...defaultProps}
          route={route}
          isActive={false}
          isCompleted={true}
          currentStopIndex={3}
        />
      )
      expect(screen.getByText('Crawl complete!')).toBeTruthy()
    })
  })
})
