import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNotificationsSync } from '../use-notifications-sync'
import type { Notification } from '@/lib/types'

vi.mock('@/lib/data', () => ({
  USE_SUPABASE_BACKEND: true,
}))

const fetchNotificationList = vi.fn()
const markNotificationsRead = vi.fn()

vi.mock('@/lib/api-client', () => ({
  fetchNotificationList: (...args: unknown[]) => fetchNotificationList(...args),
  markNotificationsRead: (...args: unknown[]) => markNotificationsRead(...args),
}))

describe('useNotificationsSync', () => {
  beforeEach(() => {
    fetchNotificationList.mockReset()
    markNotificationsRead.mockReset()
    fetchNotificationList.mockResolvedValue({
      ok: true,
      data: {
        notifications: [
          {
            id: 'n1',
            type: 'trending_venue',
            userId: 'u1',
            venueId: 'v1',
            read: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })
    markNotificationsRead.mockResolvedValue({ ok: true, data: { updated: true } })
  })

  it('hydrates notifications from the API when authenticated', async () => {
    let notifications: Notification[] = []
    const setNotifications = vi.fn((fn) => {
      notifications = typeof fn === 'function' ? fn(notifications) : fn
    })

    renderHook(() => useNotificationsSync('token-abc', setNotifications))

    await waitFor(() => {
      expect(fetchNotificationList).toHaveBeenCalledWith({
        accessToken: 'token-abc',
        limit: 100,
      })
    })
    await waitFor(() => {
      expect(setNotifications).toHaveBeenCalled()
    })
  })

  it('markRead updates local state and persists to the API', async () => {
    let notifications: Notification[] = [
      {
        id: 'n1',
        type: 'trending_venue',
        userId: 'u1',
        venueId: 'v1',
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    const setNotifications = vi.fn((fn) => {
      notifications = typeof fn === 'function' ? fn(notifications) : fn
    })

    const { result } = renderHook(() =>
      useNotificationsSync('token-abc', setNotifications),
    )

    result.current.markRead('n1')

    expect(notifications[0]?.read).toBe(true)
    expect(markNotificationsRead).toHaveBeenCalledWith(
      { id: 'n1' },
      { accessToken: 'token-abc' },
    )
  })

  it('markAllRead marks every notification read server-side', () => {
    let notifications: Notification[] = [
      {
        id: 'n1',
        type: 'trending_venue',
        userId: 'u1',
        venueId: 'v1',
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'n2',
        type: 'friend_pulse',
        userId: 'u2',
        pulseId: 'p1',
        venueId: 'v1',
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    const setNotifications = vi.fn((fn) => {
      notifications = typeof fn === 'function' ? fn(notifications) : fn
    })

    const { result } = renderHook(() =>
      useNotificationsSync('token-abc', setNotifications),
    )

    result.current.markAllRead()

    expect(notifications.every((n) => n.read)).toBe(true)
    expect(markNotificationsRead).toHaveBeenCalledWith(
      { all: true },
      { accessToken: 'token-abc' },
    )
  })
})
