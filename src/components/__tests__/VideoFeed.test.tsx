// @vitest-environment jsdom
import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- module mocks ----------------------------------------------------

const mockUseVideoFeed = vi.fn()

vi.mock('@/hooks/use-video-feed', () => ({
  useVideoFeed: (...args: unknown[]) => mockUseVideoFeed(...args),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => <div data-testid="skeleton" {...props} />,
}))

vi.mock('@/components/video/VideoCaptureSheet', () => ({
  VideoCaptureSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="video-capture-sheet-mock" /> : null,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// --- IntersectionObserver harness -----------------------------------
type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void

let observers: Array<{
  callback: IntersectionCallback
  targets: Element[]
}> = []

beforeEach(() => {
  observers = []
  class IO {
    callback: IntersectionCallback
    targets: Element[] = []
    constructor(cb: IntersectionCallback) {
      this.callback = cb
      observers.push(this)
    }
    observe(el: Element) {
      this.targets.push(el)
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', IO as unknown as typeof IntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// --- component under test (import AFTER mocks) ----------------------

import { VideoFeed } from '@/components/video/VideoFeed'

// --- fixtures -------------------------------------------------------

function fixtureItem(overrides: Partial<import('@/lib/video-client').VideoFeedItem> = {}) {
  return {
    id: 'p1',
    userId: 'u1',
    venueId: 'v1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    caption: 'hello',
    hashtags: ['live'],
    videoUrl: 'https://example.com/v.mp4',
    videoDurationMs: 5000,
    videoWidth: 720,
    videoHeight: 1280,
    videoThumbnailUrl: null,
    videoMimeType: 'video/mp4',
    videoBytes: 1024,
    venueLat: 40,
    venueLng: -74,
    pulseScore: 70,
    reactionCount: 3,
    ...overrides,
  }
}

// --- tests ----------------------------------------------------------

describe('VideoFeed', () => {
  it('renders a skeleton on initial load with no items', () => {
    mockUseVideoFeed.mockReturnValue({
      items: [],
      isLoading: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    })

    render(<VideoFeed enabled />)
    expect(screen.getByTestId('video-feed-skeleton')).toBeTruthy()
  })

  it('renders the empty state when loaded but no items', () => {
    mockUseVideoFeed.mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    })

    render(<VideoFeed enabled />)
    expect(screen.getByTestId('video-feed-empty')).toBeTruthy()
  })

  it('mounts, renders slots, and triggers play/pause via IntersectionObserver', () => {
    mockUseVideoFeed.mockReturnValue({
      items: [fixtureItem({ id: 'p1' }), fixtureItem({ id: 'p2' })],
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    })

    // Stub play/pause since jsdom has no media loop.
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {})

    render(<VideoFeed enabled />)
    expect(screen.getByTestId('video-slot-0')).toBeTruthy()
    expect(screen.getByTestId('video-slot-1')).toBeTruthy()

    // Fire intersection for the first slot.
    act(() => {
      observers[0].callback([
        {
          isIntersecting: true,
          intersectionRatio: 0.9,
          target: observers[0].targets[0],
        } as unknown as IntersectionObserverEntry,
      ])
    })
    expect(playSpy).toHaveBeenCalled()

    // And pause when not intersecting.
    act(() => {
      observers[0].callback([
        {
          isIntersecting: false,
          intersectionRatio: 0,
          target: observers[0].targets[0],
        } as unknown as IntersectionObserverEntry,
      ])
    })
    expect(pauseSpy).toHaveBeenCalled()

    playSpy.mockRestore()
    pauseSpy.mockRestore()
  })

  it('returns null when feature flag is disabled', () => {
    mockUseVideoFeed.mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    })
    const { container } = render(<VideoFeed enabled={false} />)
    expect(container.firstChild).toBeNull()
  })
})
