import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createAdminClientMock, dispatchMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  dispatchMock: vi.fn(async () => ({
    realtime: { ok: true, provider: 'supabase-realtime' },
    native: { dispatched: 1, skipped: 0, logOnly: false, errors: [] },
  })),
}))

vi.mock('../supabase-server', () => ({
  createAdminClient: () => createAdminClientMock(),
}))

vi.mock('../dispatch-notification', () => ({
  dispatchUserNotification: (...args: unknown[]) => dispatchMock(...args),
}))

import { notifyFriendsOfCheckIn, isFriendNearbyEnabled } from '../friend-nearby-notify'

type TableRow = Record<string, unknown>

function makeAdminClient(tables: Record<string, TableRow[]>) {
  const from = vi.fn((table: string) => {
    const rows = tables[table] ?? []
    const state: { filters: Array<(row: TableRow) => boolean> } = { filters: [] }

    const applyFilters = () =>
      rows.filter((row) => state.filters.every((fn) => fn(row)))

    const chain: Record<string, unknown> = {}
    const builder = new Proxy(chain, {
      get(_target, prop) {
        if (prop === 'then') {
          return (
            onFulfilled: (value: { data: TableRow[]; error: null }) => unknown,
            onRejected?: (err: unknown) => unknown,
          ) => Promise.resolve({ data: applyFilters(), error: null }).then(onFulfilled, onRejected)
        }
        if (prop === 'maybeSingle') {
          return () => {
            const data = applyFilters()[0] ?? null
            return Promise.resolve({ data, error: null })
          }
        }
        if (prop === 'insert') {
          return async () => ({ error: null })
        }
        if (prop === 'eq') {
          return (column: string, value: unknown) => {
            state.filters.push((row) => row[column] === value)
            return builder
          }
        }
        if (prop === 'contains') {
          return (column: string, values: unknown[]) => {
            state.filters.push((row) => {
              const cell = row[column]
              if (!Array.isArray(cell)) return false
              return values.every((v) => cell.includes(v))
            })
            return builder
          }
        }
        if (prop === 'in') {
          return (column: string, values: unknown[]) => {
            state.filters.push((row) => values.includes(row[column]))
            return builder
          }
        }
        if (prop === 'select') {
          return () => builder
        }
        return () => builder
      },
    })
    return builder
  })

  return { from }
}

describe('isFriendNearbyEnabled', () => {
  it('honors friendNearbyVenues pref', () => {
    expect(isFriendNearbyEnabled({ friendNearbyVenues: false })).toBe(false)
    expect(isFriendNearbyEnabled({ friendNearbyVenues: true })).toBe(true)
    expect(isFriendNearbyEnabled(undefined)).toBe(true)
  })
})

describe('notifyFriendsOfCheckIn', () => {
  beforeEach(() => {
    createAdminClientMock.mockReset()
    dispatchMock.mockClear()
  })

  it('returns zeros when admin client is unavailable', async () => {
    createAdminClientMock.mockReturnValue(null)
    const result = await notifyFriendsOfCheckIn({ userId: 'u1', venueId: 'v1' })
    expect(result).toEqual({ notified: 0, skipped: 0 })
  })

  it('notifies friends who opted in and skips disabled prefs', async () => {
    createAdminClientMock.mockReturnValue(
      makeAdminClient({
        profiles: [
          {
            id: 'u1',
            friends: ['f1'],
            display_name: 'Alex',
            username: 'alex',
            notification_settings: { friendNearbyVenues: true },
          },
          {
            id: 'f1',
            friends: ['u1'],
            notification_settings: { friendNearbyVenues: true },
          },
          {
            id: 'f2',
            friends: ['u1'],
            notification_settings: { friendNearbyVenues: false },
          },
        ],
        venues: [{ id: 'v1', name: 'Neon Room' }],
        notifications: [],
      }),
    )

    const logger = { warn: vi.fn() }
    const result = await notifyFriendsOfCheckIn(
      { userId: 'u1', venueId: 'v1' },
      logger,
    )

    expect(result.notified).toBe(1)
    expect(result.skipped).toBe(1)
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'f1',
        title: 'Alex is nearby',
        body: 'Checked in at Neon Room',
        data: expect.objectContaining({ kind: 'friend_nearby', venueId: 'v1' }),
      }),
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('returns zeros when user lookup fails', async () => {
    const logger = { warn: vi.fn() }
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'db down' } }),
          }),
        }),
      }),
    })

    const result = await notifyFriendsOfCheckIn(
      { userId: 'u1', venueId: 'v1' },
      logger,
    )

    expect(result).toEqual({ notified: 0, skipped: 0 })
    expect(logger.warn).toHaveBeenCalledWith(
      'user lookup failed',
      expect.objectContaining({ error: 'db down' }),
    )
  })
})
