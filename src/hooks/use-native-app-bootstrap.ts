import { useEffect } from 'react'
import { queryClient } from '@/lib/query-client'
import { trackError, trackPerformance } from '@/lib/analytics'
import {
  configureStatusBar,
  isNative,
  onAppStateChange,
  onPushNotificationTap,
  registerNativePush,
} from '@/lib/native-bridge'

export function useNativeAppBootstrap() {
  useEffect(() => {
    configureStatusBar().catch((error) => {
      trackError(error instanceof Error ? error : String(error), 'native_status_bar')
    })
  }, [])

  useEffect(() => {
    if (!isNative) return

    let isMounted = true

    registerNativePush()
      .then((token) => {
        if (!isMounted || !token) return
        trackPerformance('native_push_registered', 1, 'count')
      })
      .catch((error) => {
        trackError(error instanceof Error ? error : String(error), 'native_push_registration')
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const unsubscribeAppState = onAppStateChange(({ isActive }) => {
      if (!isActive) return
      queryClient.invalidateQueries({ queryKey: ['venues'] }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['pulses'] }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['events'] }).catch(() => {})
      trackPerformance('native_app_resume', 1, 'count')
    })

    const unsubscribePushTap = onPushNotificationTap(() => {
      queryClient.invalidateQueries({ queryKey: ['pulses'] }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['events'] }).catch(() => {})
      trackPerformance('native_push_open', 1, 'count')
    })

    return () => {
      unsubscribeAppState()
      unsubscribePushTap()
    }
  }, [])
}
