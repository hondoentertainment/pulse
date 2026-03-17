// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TonightsPickCard } from '../TonightsPickCard'
import type { Venue } from '@/lib/types'
import type { TonightsPick } from '@/lib/tonights-pick'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { MockIcon } = vi.hoisted(() => {
  const MockIcon = (props: Record<string, unknown>) => null
  return { MockIcon }
})

vi.mock('@phosphor-icons/react', () => ({
  X: MockIcon,
  MapPin: MockIcon,
  Lightning: MockIcon,
  Users: MockIcon,
  ArrowRight: MockIcon,
  CaretDown: MockIcon,
  CaretUp: MockIcon,
  MartiniGlass: MockIcon,
  MusicNote: MockIcon,
  ForkKnife: MockIcon,
  Coffee: MockIcon,
  Beer: MockIcon,
  Star: MockIcon,
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    button: ({
      children,
      ...props
    }: HTMLAttributes<HTMLButtonElement> & { whileHover?: unknown; whileTap?: unknown }) => {
      const { whileHover, whileTap, ...rest } = props as Record<string, unknown>
      return <button {...(rest as HTMLAttributes<HTMLButtonElement>)}>{children}</button>
    },
    circle: (props: Record<string, unknown>) => <circle {...(props as React.SVGProps<SVGCircleElement>)} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'The Rooftop Lounge',
    location: { lat: 47.61, lng: -122.32, address: '123 Pike St' },
    pulseScore: 78,
    category: 'Cocktail Bar',
    ...overrides,
  }
}

function makePick(overrides: Partial<TonightsPick> = {}): TonightsPick {
  return {
    venue: makeVenue(),
    score: 0.82,
    reasons: ['your favorite cocktail bar', 'surging right now', '3 friends nearby'],
    explanation: 'Your favorite cocktail bar is surging right now — 3 friends nearby',
    confidence: 0.75,
    alternates: [
      makeVenue({ id: 'alt-1', name: 'Blue Moon', pulseScore: 65 }),
      makeVenue({ id: 'alt-2', name: 'Neon Club', pulseScore: 55, category: 'Nightclub' }),
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TonightsPickCard', () => {
  it('renders the pick venue name and explanation', () => {
    render(<TonightsPickCard pick={makePick()} />)

    expect(screen.getByText('The Rooftop Lounge')).toBeTruthy()
    expect(
      screen.getByText('Your favorite cocktail bar is surging right now — 3 friends nearby'),
    ).toBeTruthy()
  })

  it('shows the pulse score', () => {
    render(<TonightsPickCard pick={makePick()} />)
    expect(screen.getByText('78')).toBeTruthy()
  })

  it('renders the venue category', () => {
    render(<TonightsPickCard pick={makePick()} />)
    expect(screen.getByText('Cocktail Bar')).toBeTruthy()
  })

  it('renders nothing when pick is null and not loading', () => {
    const { container } = render(<TonightsPickCard pick={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders skeleton when loading', () => {
    render(<TonightsPickCard pick={null} isLoading />)
    expect(screen.getByTestId('pick-skeleton')).toBeTruthy()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<TonightsPickCard pick={makePick()} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByTestId('dismiss-button'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onLetsGo with venue when "Let\'s Go" is clicked', () => {
    const onLetsGo = vi.fn()
    const pick = makePick()
    render(<TonightsPickCard pick={pick} onLetsGo={onLetsGo} />)

    fireEvent.click(screen.getByTestId('lets-go-button'))
    expect(onLetsGo).toHaveBeenCalledWith(pick.venue)
  })

  it('calls onToggleAlternates when "See Alternatives" is clicked', () => {
    const onToggleAlternates = vi.fn()
    render(
      <TonightsPickCard pick={makePick()} onToggleAlternates={onToggleAlternates} />,
    )

    fireEvent.click(screen.getByTestId('see-alternatives-button'))
    expect(onToggleAlternates).toHaveBeenCalledOnce()
  })

  it('shows alternates section when showAlternates is true', () => {
    render(<TonightsPickCard pick={makePick()} showAlternates />)

    expect(screen.getByTestId('alternates-section')).toBeTruthy()
    expect(screen.getByText('Blue Moon')).toBeTruthy()
    expect(screen.getByText('Neon Club')).toBeTruthy()
  })

  it('does not show alternates section when showAlternates is false', () => {
    render(<TonightsPickCard pick={makePick()} showAlternates={false} />)

    expect(screen.queryByTestId('alternates-section')).toBeNull()
  })

  it('does not show "See Alternatives" button when no alternates', () => {
    const pick = makePick({ alternates: [] })
    render(<TonightsPickCard pick={pick} />)

    expect(screen.queryByTestId('see-alternatives-button')).toBeNull()
  })

  it('calls onAlternateClick when an alternate is clicked', () => {
    const onAlternateClick = vi.fn()
    const pick = makePick()
    render(
      <TonightsPickCard
        pick={pick}
        showAlternates
        onAlternateClick={onAlternateClick}
      />,
    )

    fireEvent.click(screen.getByText('Blue Moon'))
    expect(onAlternateClick).toHaveBeenCalledWith(pick.alternates[0])
  })

  it('renders friend avatars when provided', () => {
    render(
      <TonightsPickCard
        pick={makePick()}
        friendAvatars={['https://example.com/a.jpg', 'https://example.com/b.jpg']}
      />,
    )

    expect(screen.getByTestId('friend-avatars')).toBeTruthy()
  })

  it('does not render friend avatars when none provided', () => {
    render(<TonightsPickCard pick={makePick()} />)
    expect(screen.queryByTestId('friend-avatars')).toBeNull()
  })
})
