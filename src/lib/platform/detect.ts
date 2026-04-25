/**
 * Runtime platform detection — never imports `@capacitor/*` eagerly.
 */
import type { PlatformName } from './types'

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => PlatformName
  platform?: string
}

function getCap(): CapacitorGlobal | undefined {
  if (typeof globalThis === 'undefined') return undefined
  const g = globalThis as unknown as { Capacitor?: CapacitorGlobal }
  return g.Capacitor
}

/** True iff running inside a Capacitor native container (iOS/Android). */
export function isNative(): boolean {
  const cap = getCap()
  if (!cap) return false
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform()
  // Fallback heuristic for older Capacitor versions
  return cap.platform === 'ios' || cap.platform === 'android'
}

/** Returns 'web' | 'ios' | 'android'. */
export function getPlatformName(): PlatformName {
  const cap = getCap()
  if (!cap) return 'web'
  if (typeof cap.getPlatform === 'function') {
    const p = cap.getPlatform()
    if (p === 'ios' || p === 'android') return p
    return 'web'
  }
  if (cap.platform === 'ios' || cap.platform === 'android') return cap.platform
  return 'web'
}
