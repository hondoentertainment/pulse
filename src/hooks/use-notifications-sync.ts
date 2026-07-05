import { useEffect, useCallback } from 'react'
import type { Notification } from '@/lib/types'
import { fetchNotificationList, markNotificationsRead } from '@/lib/api-client'
import { USE_SUPABASE_BACKEND } from '@/lib/data'

/**
 * Hydrate the notification feed from Supabase when authenticated,
 * and expose helpers that persist read state server-side.
 */
export function useNotificationsSync(
  accessToken: string | null | undefined,
  setNotifications: (fn: ((n: Notification[] | undefined) => Notification[]) | Notification[]) => void,
) {
  useEffect(() => {
    if (!USE_SUPABASE_BACKEND || !accessToken) return

    let active = true
    const load = () => {
      void fetchNotificationList({ accessToken, limit: 100 }).then((result) => {
        if (!active || !result.ok) return
        const items = result.data.notifications as Notification[]
        setNotifications(items)
      })
    }

    load()
    const interval = setInterval(load, 60_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [accessToken, setNotifications])

  const markRead = useCallback(
    (id: string) => {
      setNotifications((current) => {
        if (!current) return []
        return current.map((n) => (n.id === id ? { ...n, read: true } : n))
      })
      if (accessToken) {
        void markNotificationsRead({ id }, { accessToken })
      }
    },
    [accessToken, setNotifications],
  )

  const markAllRead = useCallback(() => {
    setNotifications((current) => {
      if (!current) return []
      return current.map((n) => ({ ...n, read: true }))
    })
    if (accessToken) {
      void markNotificationsRead({ all: true }, { accessToken })
    }
  }, [accessToken, setNotifications])

  return { markRead, markAllRead }
}
