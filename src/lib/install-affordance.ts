/**
 * Home-screen / PWA install affordance — shown on the map tab, not only Settings.
 */

export const INSTALL_DISMISS_STORAGE_KEY = 'pulse_install_affordance_v1'

export interface InstallAffordanceCopy {
  headline: string
  body: string
  cta: string
  iosHint: string
  menuHint: string
}

export const INSTALL_AFFORDANCE_COPY: InstallAffordanceCopy = {
  headline: 'Add Pulse to your home screen',
  body: 'Open the map in one tap — works offline with last known energy.',
  cta: 'Install Pulse',
  iosHint: 'Share → Add to Home Screen',
  menuHint: 'Use your browser menu to Install app or Add to Home Screen.',
}

export function shouldShowInstallAffordance(input: {
  canInstall: boolean
  isInstalled: boolean
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
  dismissed?: boolean
}): boolean {
  if (input.isInstalled || input.dismissed) return false
  return true
}

export function installAffordancePath(input: {
  canInstall: boolean
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
}): 'prompt' | 'ios' | 'menu' {
  if (input.canInstall) return 'prompt'
  if (input.platform === 'ios') return 'ios'
  return 'menu'
}

export function isInstallAffordanceDismissed(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): boolean {
  try {
    return store?.getItem(INSTALL_DISMISS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstallAffordance(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  try {
    store?.setItem(INSTALL_DISMISS_STORAGE_KEY, '1')
  } catch {
    /* ignore quota */
  }
}

/**
 * Share arrival only shows an install card when the browser can actually
 * install (prompt) or the device is iOS (Share → Add to Home Screen).
 * Desktop without a prompt is not eligible — no fake urgency.
 */
export function isPwaInstallEligible(input: {
  canInstall: boolean
  isInstalled: boolean
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
}): boolean {
  if (input.isInstalled) return false
  if (input.canInstall) return true
  return input.platform === 'ios'
}

/** Tonight, Capitol Hill, and eligible share arrivals. One local dismiss. */
export function shouldShowInstallOnSurface(input: {
  surface: 'tonight' | 'capitol-hill' | 'share' | 'map' | 'other'
  canInstall: boolean
  isInstalled: boolean
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
  dismissed?: boolean
}): boolean {
  if (input.dismissed || input.isInstalled) return false
  if (input.surface === 'share') return isPwaInstallEligible(input)
  if (input.surface !== 'tonight' && input.surface !== 'capitol-hill') return false
  return shouldShowInstallAffordance(input)
}
