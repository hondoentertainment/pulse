// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ShareArrivalCard } from '@/components/ShareArrivalCard'
import type { Pulse, Venue } from '@/lib/types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => ({ session: null, isPlaceholder: false }),
}))

describe('ShareArrivalCard', () => {
  it('matches the OG card and opens the map', () => {
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
    render(
      <MemoryRouter>
        <ShareArrivalCard venue={venue} pulses={pulses} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Someone shared a venue')).toBeInTheDocument()
    expect(screen.getByText('Neumos')).toBeInTheDocument()
    expect(screen.getByText(/DJ just switched/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /I'm here · open map/i }))
    expect(navigate).toHaveBeenCalledWith('/?here=neumos')
  })
})
