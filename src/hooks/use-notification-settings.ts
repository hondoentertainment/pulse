import { useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { fetchNotificationSettings, patchNotificationSettings } from '@/lib/api-client'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/lib/notification-settings'

export type { NotificationSettings } from '@/lib/notification-settings'

export function useNotificationSettings() {
  const { session, isPlaceholder } = useSupabaseAuth()
  const [settings, setSettings] = useKV<NotificationSettings>(
    'notification-settings',
    DEFAULT_NOTIFICATION_SETTINGS,
  )

  useEffect(() => {
    const token = session?.access_token
    if (!token || isPlaceholder) return

    let cancelled = false
    void fetchNotificationSettings({ accessToken: token }).then((result) => {
      if (cancelled || !result.ok) return
      setSettings(result.data)
    })

    return () => {
      cancelled = true
    }
  }, [session?.access_token, isPlaceholder, setSettings])

  const updateSetting = useCallback(
    (key: keyof NotificationSettings, value: boolean) => {
      setSettings((current) => {
        const base = current ?? DEFAULT_NOTIFICATION_SETTINGS
        return { ...base, [key]: value }
      })

      const token = session?.access_token
      if (token && !isPlaceholder) {
        void patchNotificationSettings({ [key]: value }, { accessToken: token }).catch(() => {
          // Keep optimistic local state; server sync is best-effort.
        })
      }
    },
    [session?.access_token, isPlaceholder, setSettings],
  )

  return {
    settings,
    updateSetting,
  }
}
