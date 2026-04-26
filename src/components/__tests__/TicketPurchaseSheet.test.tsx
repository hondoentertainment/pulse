// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Mocks that must exist before the component imports ──

vi.mock('framer-motion', () => {
  const strip = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {}
    const blocked = new Set([
      'initial',
      'animate',
      'exit',
      'transition',
      'whileHover',
      'whileTap',
      'whileInView',
      'whileDrag',
      'drag',
      'dragConstraints',
      'dragElastic',
      'layout',
      'layoutId',
      'variants',
      'custom',
      'onAnimationComplete',
      'style',
    ])
    for (const [k, v] of Object.entries(props)) {
      if (blocked.has(k)) continue
      if (typeof v === 'function' && !k.startsWith('on')) continue
      filtered[k] = v
    }
    return filtered
  }
  return {
    motion: {
      div: ({ children, ...p }: any) => <div {...strip(p)}>{children}</div>,
      button: ({ children, ...p }: any) => <button {...strip(p)}>{children}</button>,
      span: ({ children, ...p }: any) => <span {...strip(p)}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

vi.mock('@phosphor-icons/react', () => {
  const make = (n: string) => (p: any) => <span data-testid={`icon-${n}`} {...p} />
  return {
    Ticket: make('Ticket'),
    Users: make('Users'),
    Minus: make('Minus'),
    Plus: make('Plus'),
    Lightning: make('Lightning'),
    CaretRight: make('CaretRight'),
  }
})

const purchaseMock = vi.fn()
vi.mock('@/lib/ticketing-client', () => ({
  purchaseTicket: (...args: unknown[]) => purchaseMock(...args),
}))

import { TicketPurchaseSheet } from '@/components/TicketPurchaseSheet'
import type { VenueEvent } from '@/lib/events'
import type { User } from '@/lib/types'

const currentUser = {
  id: 'u1',
  username: 'alice',
  displayName: 'Alice',
  friends: [],
  profilePhoto: '',
  venueCheckInHistory: {},
} as unknown as User

const sampleEvent: VenueEvent = {
  id: 'evt_1',
  venueId: 'v1',
  title: 'Friday Lights',
  description: '',
  host: 'Pulse',
  startTime: new Date(Date.now() + 3 * 86400000).toISOString(),
  endTime: new Date(Date.now() + 3 * 86400000 + 4 * 3600000).toISOString(),
  coverCharge: 25,
  rsvps: {},
  attendees: [],
  genre: 'electronic',
  tags: [],
} as unknown as VenueEvent

beforeEach(() => {
  purchaseMock.mockReset()
  // Stub out window.location.assign to observe redirect.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      assign: vi.fn(),
      origin: 'https://app.test',
    },
  })
})

describe('TicketPurchaseSheet', () => {
  it('renders the event title + total price', () => {
    render(
      <TicketPurchaseSheet
        open
        onOpenChange={() => {}}
        event={sampleEvent}
        currentUser={currentUser}
        allUsers={[currentUser]}
        onPurchase={() => {}}
      />,
    )
    expect(screen.getByText('Friday Lights')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /purchase ticket/i })).toBeInTheDocument()
  })

  it('calls purchaseTicket and redirects to the Stripe checkout url on success', async () => {
    purchaseMock.mockResolvedValue({
      ok: true,
      data: {
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test',
        sessionId: 'cs_test',
        ticketId: 'tkt_1',
        ticketIds: ['tkt_1'],
      },
    })
    const onPurchase = vi.fn()
    render(
      <TicketPurchaseSheet
        open
        onOpenChange={() => {}}
        event={sampleEvent}
        currentUser={currentUser}
        allUsers={[currentUser]}
        onPurchase={onPurchase}
      />,
    )
    const btn = screen.getByRole('button', { name: /purchase ticket/i })
    fireEvent.click(btn)

    await waitFor(() => expect(purchaseMock).toHaveBeenCalledTimes(1))
    const args = purchaseMock.mock.calls[0][0]
    expect(args.eventId).toBe('evt_1')
    expect(args.quantity).toBe(1)
    expect(args.ticketType).toBe('general_admission')

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/pay/cs_test',
      ),
    )
    expect(onPurchase).toHaveBeenCalledWith([])
  })

  it('shows an error message and does NOT redirect on failure', async () => {
    purchaseMock.mockResolvedValue({
      ok: false,
      error: 'event_not_purchasable',
      status: 403,
    })
    render(
      <TicketPurchaseSheet
        open
        onOpenChange={() => {}}
        event={sampleEvent}
        currentUser={currentUser}
        allUsers={[currentUser]}
        onPurchase={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /purchase ticket/i }))
    await waitFor(() => expect(purchaseMock).toHaveBeenCalled())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/event_not_purchasable/)
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  it('disables the button while purchase is in-flight', async () => {
    let resolve!: (v: unknown) => void
    purchaseMock.mockImplementation(
      () => new Promise(r => {
        resolve = r
      }),
    )
    render(
      <TicketPurchaseSheet
        open
        onOpenChange={() => {}}
        event={sampleEvent}
        currentUser={currentUser}
        allUsers={[currentUser]}
        onPurchase={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: /purchase ticket/i })
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toHaveAttribute('aria-busy', 'true'))
    expect(btn).toBeDisabled()
    resolve({
      ok: true,
      data: { checkoutUrl: 'x', sessionId: 's', ticketId: 't', ticketIds: ['t'] },
    })
  })
})
