/**
 * Platform type contracts — identical surface across web and native.
 */

export type PlatformName = 'web' | 'ios' | 'android'

export interface PushRegistrationResult {
  token: string | null
  platform: 'ios' | 'android' | 'web'
  granted: boolean
  provisional?: boolean
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean
  maximumAge?: number
  timeout?: number
  /** Native-only — request background location permission. Web ignores. */
  background?: boolean
}

export interface GeolocationPosition {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
    altitude?: number | null
    altitudeAccuracy?: number | null
    heading?: number | null
    speed?: number | null
  }
  timestamp: number
}

export interface CameraPickOptions {
  /** 'prompt' lets the user choose camera vs gallery on native; web always opens file picker */
  source?: 'camera' | 'gallery' | 'prompt'
  quality?: number
  allowEditing?: boolean
}

export interface CameraPickResult {
  dataUrl?: string
  blob?: Blob
  format: 'jpeg' | 'png' | 'webp' | 'unknown'
}

export interface ShareOptions {
  title?: string
  text?: string
  url?: string
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'
