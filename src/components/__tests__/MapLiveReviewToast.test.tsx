// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapLiveReviewToast } from '@/components/MapLiveReviewToast'
import type { MapLiveToast } from '@/lib/map-live-reviews'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@/lib/haptics', () => ({
  triggerHapticFeedback: vi.fn(),
}))

const toast: MapLiveToast = {
  id: 'p-1',
  venueId: 'venue-1',
  venueName: 'Neon Lounge',
  snippet: 'DJ just switched — floor is packed.',
  energy: 'electric',
  createdAt: new Date().toISOString(),
  headline: '⚡ Neon Lounge just went Electric',
}

describe('MapLiveReviewToast', () => {
  it('renders nothing without a toast', () => {
    const { container } = render(
      <MapLiveReviewToast toast={null} onDismiss={vi.fn()} onOpen={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Live · venue · snippet and opens on tap', () => {
    const onOpen = vi.fn()
    render(<MapLiveReviewToast toast={toast} onDismiss={vi.fn()} onOpen={onOpen} />)
    expect(screen.getByText('⚡ Neon Lounge just went Electric')).toBeInTheDocument()
    expect(screen.getByText(/DJ just switched/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(toast)
  })
})
