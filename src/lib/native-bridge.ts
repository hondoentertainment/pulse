/**
 * Native Bridge — Platform-Aware Capacitor Abstractions
 *
 * Provides unified APIs that automatically switch between browser Web APIs
 * and native Capacitor plugins depending on the runtime environment.
 * This allows the same codebase to run as a PWA or a native iOS/Android app.
 */

import { Capacitor } from '@capacitor/core'
import { Geolocation as CapGeolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { PushNotifications } from '@capacitor/push-notifications'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App } from '@capacitor/app'

/** Whether we're running inside a native Capacitor shell */
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'

// ─── Geolocation ─────────────────────────────────────────
/**
 * Request location permissions using the native OS dialog (not browser).
 * On web, falls back to standard navigator.geolocation.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (!isNative) {
    // Web fallback
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state !== 'denied'
    } catch {
      return true // Assume allowed, will fail at getCurrentPosition
    }
  }

  const status = await CapGeolocation.requestPermissions()
  return status.location === 'granted' || status.coarseLocation === 'granted'
}

/**
 * Get the current position using native GPS (higher accuracy, background capable).
 */
export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    if (isNative) {
      const pos = await CapGeolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    }

    // Web fallback
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  } catch {
    return null
  }
}

/**
 * Watch position with native GPS. Returns a cleanup function.
 */
export function watchPosition(
  callback: (pos: { lat: number; lng: number }) => void
): () => void {
  if (isNative) {
    const watchId = CapGeolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos) => {
        if (pos) callback({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      }
    )

    return () => {
      watchId.then((id) => CapGeolocation.clearWatch({ id }))
    }
  }

  // Web fallback
  const id = navigator.geolocation.watchPosition(
    (pos) => callback({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    undefined,
    { enableHighAccuracy: true }
  )
  return () => navigator.geolocation.clearWatch(id)
}

// ─── Haptics ─────────────────────────────────────────────
/**
 * Trigger haptic feedback. Falls back to navigator.vibrate on web.
 */
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (isNative) {
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] })
    return
  }
  navigator.vibrate?.([style === 'light' ? 10 : style === 'medium' ? 20 : 40])
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (isNative) {
    const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error }
    await Haptics.notification({ type: map[type] })
    return
  }
  navigator.vibrate?.([20, 50, 20])
}

// ─── Push Notifications ──────────────────────────────────
/**
 * Register for native push notifications.
 * Returns the device token for server-side targeting.
 */
export async function registerNativePush(): Promise<string | null> {
  if (!isNative) return null

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return null

  await PushNotifications.register()

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (token) => {
      resolve(token.value)
    })
    PushNotifications.addListener('registrationError', () => {
      resolve(null)
    })
  })
}

/**
 * Listen for incoming push notification taps.
 */
export function onPushNotificationTap(
  callback: (data: Record<string, unknown>) => void
): () => void {
  if (!isNative) return () => {}

  const listener = PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    callback(notification.notification.data)
  })

  return () => {
    listener.then(handle => handle.remove()).catch(() => {})
  }
}

// ─── Status Bar ──────────────────────────────────────────
/**
 * Configure the native status bar for the Midnight Sapphire theme.
 */
export async function configureStatusBar() {
  if (!isNative) return
  await StatusBar.setStyle({ style: Style.Dark })
  if (platform === 'android') {
    await StatusBar.setBackgroundColor({ color: '#0a0a0f' })
  }
}

// ─── App Lifecycle ───────────────────────────────────────
/**
 * Listen for app state changes (foreground/background).
 */
export function onAppStateChange(
  callback: (state: { isActive: boolean }) => void
): () => void {
  if (!isNative) {
    // Web fallback using visibility API
    const handler = () => {
      callback({ isActive: document.visibilityState === 'visible' })
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }
  const listener = App.addListener('appStateChange', callback)
  return () => {
    listener.then(handle => handle.remove()).catch(() => {})
  }
}
