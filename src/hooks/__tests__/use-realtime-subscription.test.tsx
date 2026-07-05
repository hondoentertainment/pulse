// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Lifecycle + payload-mapping coverage for useRealtimeSubscription — the hook
 * that fans Supabase Realtime WebSocket events through the batching middleware
 * into the React Query cache. Previously untested despite being on the hot path
 * for viral venues (500 reactions → 1 batched re-render).
 *
 * We mock Supabase's channel builder to capture the registered
 * `postgres_changes` handlers so we can drive them synthetically, and mock the
 * shared queryClient so cache writes are observable. Real batcher singletons run
 * under fake timers so we exercise the genuine flush path.
 */

type ChangeHandler = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => void

const { channelState, supabaseMock, queryStore, queryClientMock } = vi.hoisted(() => {
  const channelState = {
    handlers: new Map<string, ChangeHandler>(),
    subscribeCalls: 0,
    unsubscribeCalls: 0,
    channelName: '',
  }

  const builder: Record<string, unknown> = {}
  builder.on = (
    _event: string,
    filter: { event: string; table: string },
    handler: ChangeHandler,
  ) => {
    channelState.handlers.set(`${filter.table}:${filter.event}`, handler)
    return builder
  }
  builder.subscribe = () => {
    channelState.subscribeCalls += 1
    return {
      unsubscribe: () => {
        channelState.unsubscribeCalls += 1
      },
    }
  }

  const supabaseMock = {
    channel: (name: string) => {
      channelState.channelName = name
      return builder
    },
  }

  const queryStore = new Map<string, unknown>()
  const queryClientMock = {
    setQueryData: vi.fn((key: unknown, updater: unknown) => {
      const k = JSON.stringify(key)
      const prev = queryStore.get(k)
      const next = typeof updater === 'function' ? (updater as (old: unknown) => unknown)(prev) : updater
      queryStore.set(k, next)
      return next
    }),
    getQueryData: (key: unknown) => queryStore.get(JSON.stringify(key)),
    invalidateQueries: vi.fn(async () => undefined),
  }

  return { channelState, supabaseMock, queryStore, queryClientMock }
})

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }))
vi.mock('@/lib/query-client', () => ({ queryClient: queryClientMock }))
vi.mock('@/lib/analytics', () => ({ trackPerformance: vi.fn() }))
vi.mock('@/lib/supabase-api', () => ({
  mapVenueLiveReport: (row: { id: string; venue_id: string }) => ({ id: row.id, venueId: row.venue_id }),
  mapVenueLiveAggregate: (row: { venue_id: string }) => ({
    venueId: row.venue_id,
    crowdLevel: 0,
    updatedAt: new Date(0).toISOString(),
    lastReportAt: null,
  }),
}))

import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription'

beforeEach(() => {
  vi.useFakeTimers()
  channelState.handlers.clear()
  channelState.subscribeCalls = 0
  channelState.unsubscribeCalls = 0
  channelState.channelName = ''
  queryStore.clear()
  queryClientMock.setQueryData.mockClear()
  queryClientMock.invalidateQueries.mockClear()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('useRealtimeSubscription', () => {
  it('does not subscribe when disabled', () => {
    renderHook(() => useRealtimeSubscription(false))
    expect(channelState.subscribeCalls).toBe(0)
    expect(channelState.handlers.size).toBe(0)
  })

  it('subscribes and registers postgres_changes handlers when enabled', () => {
    renderHook(() => useRealtimeSubscription(true))
    expect(channelState.channelName).toBe('pulse-realtime')
    expect(channelState.subscribeCalls).toBe(1)
    // pulses INSERT + pulses UPDATE + venues UPDATE + live reports + live aggregates
    expect(channelState.handlers.has('pulses:INSERT')).toBe(true)
    expect(channelState.handlers.has('pulses:UPDATE')).toBe(true)
    expect(channelState.handlers.has('venues:UPDATE')).toBe(true)
  })

  it('unsubscribes and tears down on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeSubscription(true))
    expect(channelState.unsubscribeCalls).toBe(0)
    unmount()
    expect(channelState.unsubscribeCalls).toBe(1)
  })

  it('maps a pulses INSERT payload into the batched pulses cache', () => {
    renderHook(() => useRealtimeSubscription(true))
    const insert = channelState.handlers.get('pulses:INSERT')
    expect(insert).toBeDefined()

    insert!({
      new: {
        id: 'pulse-123',
        user_id: 'user-9',
        venue_id: 'venue-4',
        photos: ['a.jpg'],
        energy_rating: 'electric',
        caption: 'packed',
        hashtags: ['live'],
        reactions: { fire: ['user-2'], eyes: [], skull: [], lightning: [] },
        created_at: new Date(0).toISOString(),
        expires_at: new Date(0).toISOString(),
      },
    })

    // Nothing flushed yet — the batcher holds events until its interval ticks.
    expect(queryClientMock.getQueryData(['pulses'])).toBeUndefined()

    // Advance past the pulse batcher's 1.5s cadence to force a flush.
    vi.advanceTimersByTime(1600)

    const pulses = queryClientMock.getQueryData(['pulses']) as Array<{ id: string; energyRating: string }>
    expect(pulses).toHaveLength(1)
    expect(pulses[0].id).toBe('pulse-123')
    expect(pulses[0].energyRating).toBe('electric')
  })

  it('collapses duplicate pulse inserts by id', () => {
    renderHook(() => useRealtimeSubscription(true))
    const insert = channelState.handlers.get('pulses:INSERT')!

    const row = {
      new: {
        id: 'pulse-dup',
        user_id: 'user-1',
        venue_id: 'venue-1',
        photos: [],
        energy_rating: 'buzzing',
        caption: null,
        hashtags: [],
        reactions: { fire: [], eyes: [], skull: [], lightning: [] },
        created_at: new Date(0).toISOString(),
        expires_at: new Date(0).toISOString(),
      },
    }
    insert(row)
    insert(row)
    vi.advanceTimersByTime(1600)

    const pulses = queryClientMock.getQueryData(['pulses']) as Array<{ id: string }>
    expect(pulses).toHaveLength(1)
  })
})
