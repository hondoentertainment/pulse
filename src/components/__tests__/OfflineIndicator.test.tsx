// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OfflineBanner,
  SyncProgress,
  VenueCacheBadge,
  CacheManager,
  OfflineIndicator,
} from '../OfflineIndicator'
import type { CacheStats } from '@/lib/offline-cache'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@phosphor-icons/react', () => ({
  WifiSlash: () => <span data-testid="icon-wifi-slash" />,
  ArrowsClockwise: () => <span data-testid="icon-refresh" />,
  Trash: () => <span data-testid="icon-trash" />,
  Database: () => <span data-testid="icon-database" />,
  CloudArrowUp: () => <span data-testid="icon-cloud" />,
  CaretDown: () => <span data-testid="icon-caret-down" />,
  CaretUp: () => <span data-testid="icon-caret-up" />,
}))

const defaultStats: CacheStats = {
  hitRate: 0.75,
  totalEntries: 12,
  usedBytes: 24576,
  oldestEntry: Date.now() - 10 * 60 * 1000,
}

describe('OfflineBanner', () => {
  it('renders offline message with relative time', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    render(<OfflineBanner lastSyncTime={fiveMinAgo} />)

    expect(screen.getByTestId('offline-banner')).toBeTruthy()
    expect(screen.getByText(/You're offline/)).toBeTruthy()
    expect(screen.getByText(/5m ago/)).toBeTruthy()
  })

  it('shows "unknown" when no sync time', () => {
    render(<OfflineBanner lastSyncTime={null} />)
    expect(screen.getByText(/unknown/)).toBeTruthy()
  })
})

describe('SyncProgress', () => {
  it('renders sync progress', () => {
    render(<SyncProgress total={5} synced={2} />)

    expect(screen.getByTestId('sync-progress')).toBeTruthy()
    expect(screen.getByText(/Syncing 2 of 5 queued actions/)).toBeTruthy()
  })
})

describe('VenueCacheBadge', () => {
  it('renders cached timestamp', () => {
    const threeMinAgo = Date.now() - 3 * 60 * 1000
    render(<VenueCacheBadge cachedAt={threeMinAgo} />)

    expect(screen.getByTestId('venue-cache-badge')).toBeTruthy()
    expect(screen.getByText(/Cached 3m ago/)).toBeTruthy()
  })
})

describe('CacheManager', () => {
  const onClear = vi.fn()
  const onRefresh = vi.fn()

  beforeEach(() => {
    onClear.mockReset()
    onRefresh.mockReset()
  })

  it('renders collapsed by default', () => {
    render(<CacheManager stats={defaultStats} onClear={onClear} onRefresh={onRefresh} />)

    expect(screen.getByTestId('cache-manager')).toBeTruthy()
    expect(screen.getByText('Offline Cache')).toBeTruthy()
    // Stats should not be visible yet
    expect(screen.queryByText('Cached entries')).toBeNull()
  })

  it('expands to show stats when clicked', () => {
    render(<CacheManager stats={defaultStats} onClear={onClear} onRefresh={onRefresh} />)

    fireEvent.click(screen.getByText('Offline Cache'))

    expect(screen.getByText('Cached entries')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Cache size')).toBeTruthy()
    expect(screen.getByText('75%')).toBeTruthy()
  })

  it('calls onClear when clear button is clicked', () => {
    render(<CacheManager stats={defaultStats} onClear={onClear} onRefresh={onRefresh} />)

    fireEvent.click(screen.getByText('Offline Cache'))
    fireEvent.click(screen.getByText('Clear'))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('calls onRefresh when refresh button is clicked', () => {
    render(<CacheManager stats={defaultStats} onClear={onClear} onRefresh={onRefresh} />)

    fireEvent.click(screen.getByText('Offline Cache'))
    fireEvent.click(screen.getByText('Refresh'))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})

describe('OfflineIndicator', () => {
  const baseProps = {
    isOnline: true,
    lastSyncTime: Date.now() - 5 * 60 * 1000,
    syncProgress: null,
    cacheStats: defaultStats,
    onClearCache: vi.fn(),
    onRefreshCache: vi.fn(),
  }

  it('shows nothing when online with no sync progress', () => {
    const { container } = render(<OfflineIndicator {...baseProps} />)
    expect(container.querySelector('[data-testid="offline-banner"]')).toBeNull()
    expect(container.querySelector('[data-testid="sync-progress"]')).toBeNull()
  })

  it('shows offline banner when offline', () => {
    render(<OfflineIndicator {...baseProps} isOnline={false} />)
    expect(screen.getByTestId('offline-banner')).toBeTruthy()
  })

  it('shows sync progress when online with queued actions', () => {
    render(
      <OfflineIndicator
        {...baseProps}
        isOnline={true}
        syncProgress={{ total: 3, synced: 1 }}
      />
    )
    expect(screen.getByTestId('sync-progress')).toBeTruthy()
    expect(screen.getByText(/Syncing 1 of 3/)).toBeTruthy()
  })
})
