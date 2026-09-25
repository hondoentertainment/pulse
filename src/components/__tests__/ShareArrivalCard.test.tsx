// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareArrivalCard } from '@/components/ShareArrivalCard'
import type { Pulse, Venue } from '@/lib/types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

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
  })

  it('starts the signed-in create path on the focused pin', () => {
    authState.session = { user: { id: 'u1' } }
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /I'm here · open map/i }))
    expect(navigate).toHaveBeenCalledWith('/?here=neumos&create=1')
  })

  it('sends a guest who posts a live review to auth', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Post a live review' }))
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/auth/))
    expect(screen.queryByLabelText('Install Pulse')).not.toBeInTheDocument()
  })
})
