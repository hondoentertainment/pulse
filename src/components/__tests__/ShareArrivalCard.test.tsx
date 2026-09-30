// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareArrivalCard } from '@/components/ShareArrivalCard'
import type { Pulse, Venue } from '@/lib/types'

const navigate = vi.fn()
const { confirmImHere } = vi.hoisted(() => ({
  confirmImHere: vi.fn(async () => ({ notified: true, reason: 'confirmed' as const })),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('@/lib/im-here-confirm', () => ({
  confirmImHere,
}))

const authState = { session: null as { user?: { id: string } } | null, isPlaceholder: false }
vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => authState,
}))

function renderCard() {
  const venue: Venue = {
    id: 'neumos',
    name: 'Neumos',
    location: { lat: 47.6, lng: -122.3, address: '1' },
    pulseScore: 88,
  }
  const pulses: Pulse[] = [{
    id: 'p1',
    userId: 'u1',
    venueId: 'neumos',
    photos: [],
    energyRating: 'electric',
    caption: 'DJ just switched — floor is packed.',
    kind: 'review',
    hasBody: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
  }]
  return render(
    <MemoryRouter>
      <ShareArrivalCard venue={venue} pulses={pulses} />
    </MemoryRouter>,
  )
}

describe('ShareArrivalCard', () => {
  beforeEach(() => {
    navigate.mockReset()
    confirmImHere.mockClear()
    confirmImHere.mockResolvedValue({ notified: true, reason: 'confirmed' })
    authState.session = null
    authState.isPlaceholder = false
  })

  it('matches the OG card and opens the map for guests', () => {
    renderCard()
    expect(screen.getByText('Someone shared a venue')).toBeInTheDocument()
    expect(screen.getByText('Neumos')).toBeInTheDocument()
    expect(screen.getByText(/DJ just switched/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /I'm here · open map/i }))
    expect(navigate).toHaveBeenCalledWith('/?here=neumos')
    expect(confirmImHere).not.toHaveBeenCalled()
  })

  it('confirms presence and push once, then focuses the map for a signed-in user', async () => {
    authState.session = { user: { id: 'u1' } }
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /I'm here · open map/i }))
    await waitFor(() => {
      expect(confirmImHere).toHaveBeenCalledTimes(1)
    })
    expect(confirmImHere).toHaveBeenCalledWith({
      venueId: 'neumos',
      venueName: 'Neumos',
      signedIn: true,
      lat: undefined,
      lng: undefined,
    })
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/?here=neumos&create=1')
    })
    expect(confirmImHere.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0])
  })

  it('does not confirm twice from a double tap before the first confirm settles', async () => {
    authState.session = { user: { id: 'u1' } }
    let release: (value: { notified: boolean; reason: 'confirmed' }) => void = () => undefined
    confirmImHere.mockImplementation(() => new Promise((resolve) => {
      release = resolve
    }))
    renderCard()
    const button = screen.getByRole('button', { name: /I'm here · open map/i })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(confirmImHere).toHaveBeenCalledTimes(1)
    release({ notified: true, reason: 'confirmed' })
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1)
    })
  })

  it('sends a guest who posts a live review to auth', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Post a live review' }))
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/auth/))
    expect(screen.queryByLabelText('Install Pulse')).not.toBeInTheDocument()
  })
})
