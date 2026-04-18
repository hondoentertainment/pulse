/**
 * Platform — facade that delegates to native plugins when available,
 * or falls back to web equivalents otherwise.
 *
 * All `@capacitor/*` imports are dynamic (`await import(...)`) so they are
 * only resolved at runtime on native. The web bundle's static analysis never
 * sees them as hard dependencies.
 */
import { isNative, getPlatformName } from './detect'
import { loadNativeModule } from './dynamic-import'
import type {
  CameraPickOptions,
  CameraPickResult,
  GeolocationOptions,
  GeolocationPosition,
  HapticStyle,
  PushRegistrationResult,
  ShareOptions,
} from './types'

// ── Minimal shape contracts for native modules we consume ───────────
interface PushModule {
  PushNotifications: {
    checkPermissions: () => Promise<{ receive: string }>
    requestPermissions: () => Promise<{ receive: string }>
    register: () => Promise<void>
    removeAllListeners: () => Promise<void>
    addListener: (evt: string, cb: (...args: unknown[]) => void) => Promise<{ remove?: () => void }>
  }
}

interface GeolocationModule {
  Geolocation: {
    checkPermissions: () => Promise<{ location: string }>
    requestPermissions: () => Promise<{ location: string }>
    getCurrentPosition: (opts: {
      enableHighAccuracy?: boolean
      maximumAge?: number
      timeout?: number
    }) => Promise<{ coords: GeolocationPosition['coords']; timestamp: number }>
    watchPosition: (
      opts: { enableHighAccuracy?: boolean; maximumAge?: number; timeout?: number },
      cb: (pos: { coords: GeolocationPosition['coords']; timestamp: number } | null) => void,
    ) => Promise<string>
    clearWatch: (args: { id: string }) => Promise<void>
  }
}

interface CameraModule {
  Camera: {
    getPhoto: (opts: {
      quality?: number
      allowEditing?: boolean
      resultType: string
      source: string
    }) => Promise<{ dataUrl?: string; format?: string }>
  }
  CameraResultType: { DataUrl: string }
  CameraSource: { Prompt: string; Camera: string; Photos: string }
}

interface ShareModule {
  Share: { share: (opts: { title?: string; text?: string; url?: string }) => Promise<void> }
}

interface HapticsModule {
  Haptics: {
    impact: (opts: { style: string }) => Promise<void>
    notification: (opts: { type: string }) => Promise<void>
    selectionStart: () => Promise<void>
  }
  ImpactStyle: { Light: string; Medium: string; Heavy: string }
  NotificationType: { Success: string; Warning: string; Error: string }
}

// ── Push ─────────────────────────────────────────────────────────────
async function pushRegister(): Promise<PushRegistrationResult> {
  if (!isNative()) {
    return { token: null, platform: 'web', granted: false }
  }
  try {
    const { PushNotifications } = await loadNativeModule<PushModule>('@capacitor/push-notifications')

    const perm = await PushNotifications.checkPermissions()
    let status = perm.receive
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      const req = await PushNotifications.requestPermissions()
      status = req.receive
    }
    if (status !== 'granted') {
      return { token: null, platform: getPlatformName() as 'ios' | 'android', granted: false }
    }

    // Register and wait for token via one-shot listener
    const token = await new Promise<string | null>((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve(null)
        }
      }, 10000)

      PushNotifications.addListener('registration', (t: { value: string }) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        resolve(t.value)
      })
      PushNotifications.addListener('registrationError', () => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        resolve(null)
      })
      PushNotifications.register()
    })

    return {
      token,
      platform: getPlatformName() as 'ios' | 'android',
      granted: !!token,
    }
  } catch (err) {
    console.warn('[platform] pushRegister failed', err)
    return { token: null, platform: getPlatformName() as 'ios' | 'android', granted: false }
  }
}

async function pushUnregister(): Promise<void> {
  if (!isNative()) return
  try {
    const { PushNotifications } = await loadNativeModule<PushModule>('@capacitor/push-notifications')
    await PushNotifications.removeAllListeners()
  } catch (err) {
    console.warn('[platform] pushUnregister failed', err)
  }
}

// ── Geolocation ──────────────────────────────────────────────────────
async function getCurrentPosition(opts: GeolocationOptions = {}): Promise<GeolocationPosition | null> {
  if (isNative()) {
    try {
      const { Geolocation } = await loadNativeModule<GeolocationModule>('@capacitor/geolocation')
      const perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions()
        if (req.location !== 'granted') return null
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: opts.enableHighAccuracy ?? true,
        maximumAge: opts.maximumAge ?? 5000,
        timeout: opts.timeout ?? 10000,
      })
      return {
        coords: pos.coords,
        timestamp: pos.timestamp,
      }
    } catch (err) {
      console.warn('[platform] native geolocation failed', err)
      return null
    }
  }

  // Web fallback
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          },
          timestamp: pos.timestamp,
        })
      },
      () => resolve(null),
      {
        enableHighAccuracy: opts.enableHighAccuracy ?? true,
        maximumAge: opts.maximumAge ?? 5000,
        timeout: opts.timeout ?? 10000,
      },
    )
  })
}

async function watchPosition(
  cb: (pos: GeolocationPosition) => void,
  opts: GeolocationOptions = {},
): Promise<() => void> {
  if (isNative()) {
    try {
      const { Geolocation } = await loadNativeModule<GeolocationModule>('@capacitor/geolocation')
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: opts.enableHighAccuracy ?? true,
          maximumAge: opts.maximumAge ?? 5000,
          timeout: opts.timeout ?? 20000,
        },
        (pos) => {
          if (pos) cb({ coords: pos.coords, timestamp: pos.timestamp })
        },
      )
      return () => { void Geolocation.clearWatch({ id }) }
    } catch (err) {
      console.warn('[platform] native watchPosition failed', err)
      return () => undefined
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => undefined
  const webId = navigator.geolocation.watchPosition(
    (pos) => {
      cb({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        },
        timestamp: pos.timestamp,
      })
    },
    undefined,
    {
      enableHighAccuracy: opts.enableHighAccuracy ?? true,
      maximumAge: opts.maximumAge ?? 5000,
      timeout: opts.timeout ?? 20000,
    },
  )
  return () => navigator.geolocation.clearWatch(webId)
}

// ── Camera ───────────────────────────────────────────────────────────
async function cameraPick(opts: CameraPickOptions = {}): Promise<CameraPickResult | null> {
  if (isNative()) {
    try {
      const cam = await loadNativeModule<CameraModule>('@capacitor/camera')
      const { Camera, CameraResultType, CameraSource } = cam
      const source =
        opts.source === 'camera'
          ? CameraSource.Camera
          : opts.source === 'gallery'
            ? CameraSource.Photos
            : CameraSource.Prompt
      const photo = await Camera.getPhoto({
        quality: opts.quality ?? 75,
        allowEditing: opts.allowEditing ?? false,
        resultType: CameraResultType.DataUrl,
        source,
      })
      return {
        dataUrl: photo.dataUrl,
        format: (photo.format as CameraPickResult['format']) || 'unknown',
      }
    } catch (err) {
      console.warn('[platform] native camera pick failed', err)
      return null
    }
  }

  // Web fallback: hidden file input
  if (typeof document === 'undefined') return null
  return new Promise<CameraPickResult | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (opts.source === 'camera') input.setAttribute('capture', 'environment')
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          dataUrl: reader.result as string,
          blob: file,
          format: (file.type.split('/')[1] || 'unknown') as CameraPickResult['format'],
        })
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })
}

// ── Share ────────────────────────────────────────────────────────────
async function share(opts: ShareOptions): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await loadNativeModule<ShareModule>('@capacitor/share')
      await Share.share({ title: opts.title, text: opts.text, url: opts.url })
      return true
    } catch (err) {
      console.warn('[platform] native share failed', err)
      return false
    }
  }

  if (typeof navigator === 'undefined') return false

  const nav = navigator as Navigator & {
    share?: (d: ShareOptions) => Promise<void>
    clipboard?: { writeText: (s: string) => Promise<void> }
  }

  if (typeof nav.share === 'function') {
    try {
      await nav.share(opts)
      return true
    } catch {
      return false
    }
  }

  // Last-ditch: copy URL to clipboard
  if (nav.clipboard && opts.url) {
    try {
      await nav.clipboard.writeText(opts.url)
      return true
    } catch {
      return false
    }
  }
  return false
}

// ── Haptics ──────────────────────────────────────────────────────────
async function haptics(style: HapticStyle = 'light'): Promise<void> {
  if (isNative()) {
    try {
      // Capacitor's Haptics plugin is optional — we fall back to Web Vibration
      // if not present on the device.
      const mod = await loadNativeModule<HapticsModule>('@capacitor/haptics').catch(() => null)
      if (!mod) throw new Error('haptics plugin missing')
      const { Haptics, ImpactStyle, NotificationType } = mod
      switch (style) {
        case 'light':
          return Haptics.impact({ style: ImpactStyle.Light })
        case 'medium':
          return Haptics.impact({ style: ImpactStyle.Medium })
        case 'heavy':
          return Haptics.impact({ style: ImpactStyle.Heavy })
        case 'success':
          return Haptics.notification({ type: NotificationType.Success })
        case 'warning':
          return Haptics.notification({ type: NotificationType.Warning })
        case 'error':
          return Haptics.notification({ type: NotificationType.Error })
        case 'selection':
          return Haptics.selectionStart()
      }
    } catch {
      // Fall through to web vibration below
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const pattern: number | number[] =
      style === 'heavy' ? 50 : style === 'medium' ? 25 : style === 'success' ? [10, 50, 20] : 10
    try {
      navigator.vibrate(pattern)
    } catch {
      /* no-op */
    }
  }
}

// ── Facade ───────────────────────────────────────────────────────────
export const Platform = {
  isNative,
  name: getPlatformName,
  push: {
    register: pushRegister,
    unregister: pushUnregister,
  },
  geolocation: {
    getCurrentPosition,
    watchPosition,
  },
  camera: {
    pick: cameraPick,
  },
  share,
  haptics,
} as const
