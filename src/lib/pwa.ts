/**
 * PWA & Platform Expansion
 *
 * Service worker registration, install prompt management,
 * push notification helpers, and camera/media picker integration.
 */

export interface InstallPromptState {
  canInstall: boolean
  isInstalled: boolean
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

/**
 * Register the service worker.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return registration
  } catch {
    return null
  }
}

/**
 * Listen for the beforeinstallprompt event.
 * Returns cleanup function.
 */
export function listenForInstallPrompt(
  onPromptAvailable: () => void
): () => void {
  const handler = (e: Event) => {
    e.preventDefault()
    deferredPrompt = e
    onPromptAvailable()
  }
  window.addEventListener('beforeinstallprompt', handler)
  return () => window.removeEventListener('beforeinstallprompt', handler)
}

/**
 * Show the browser install prompt.
 */
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  return outcome === 'accepted'
}

/**
 * Detect current install state.
 */
export function getInstallState(): InstallPromptState {
  const isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  const ua = navigator.userAgent.toLowerCase()
  let platform: InstallPromptState['platform'] = 'unknown'
  if (/iphone|ipad|ipod/.test(ua)) platform = 'ios'
  else if (/android/.test(ua)) platform = 'android'
  else if (/win|mac|linux/.test(ua)) platform = 'desktop'

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    platform,
  }
}

/**
 * Request push notification permission and return the subscription.
 */
export async function requestPushPermission(): Promise<PushSubscription | null> {
  if (!('Notification' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  if (!('serviceWorker' in navigator)) return null

  const registration = await navigator.serviceWorker.ready
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // In production, this would be a real VAPID key
      applicationServerKey: urlBase64ToUint8Array(
        'BPh-fake-vapid-key-for-development-only-replace-in-production-with-real-key-00'
      ),
    })
    return subscription
  } catch {
    return null
  }
}

/**
 * Check current push notification state.
 */
export function getPushPermissionState(): 'prompt' | 'granted' | 'denied' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission as 'prompt' | 'granted' | 'denied'
}

/**
 * Send a local notification (for testing/offline use).
 */
export async function sendLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker?.ready
  if (reg) {
    reg.showNotification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200],
      ...options,
    })
  }
}

/**
 * Open camera for photo capture.
 * Returns a File or null if cancelled.
 */
export function openCamera(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = () => {
      resolve(input.files?.[0] ?? null)
    }
    // Handle cancel
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) resolve(null)
        window.removeEventListener('focus', onFocus)
      }, 300)
    }
    window.addEventListener('focus', onFocus)
    input.click()
  })
}

/**
 * Open media picker for photo/video selection.
 * Returns selected files.
 */
export function openMediaPicker(options?: {
  accept?: string
  multiple?: boolean
}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = options?.accept ?? 'image/*,video/*'
    input.multiple = options?.multiple ?? true
    input.onchange = () => {
      resolve(Array.from(input.files ?? []))
    }
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) resolve([])
        window.removeEventListener('focus', onFocus)
      }, 300)
    }
    window.addEventListener('focus', onFocus)
    input.click()
  })
}

/**
 * Convert a base64 VAPID key to Uint8Array for push subscription.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Check if app update is available.
 */
export async function checkForUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.ready
  await reg.update()
  return !!reg.waiting
}

/**
 * Apply pending service worker update.
 */
export function applyUpdate(): void {
  navigator.serviceWorker?.ready.then(reg => {
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  })
}
