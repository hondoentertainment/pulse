import { describe, expect, it } from 'vitest'
import {
  INSTALL_AFFORDANCE_COPY,
  INSTALL_DISMISS_STORAGE_KEY,
  dismissInstallAffordance,
  installAffordancePath,
  isInstallAffordanceDismissed,
  shouldShowInstallAffordance,
  shouldShowInstallOnSurface,
} from '../install-affordance'

describe('install affordance', () => {
  it('shows a non-blocking path unless the app is installed or dismissed', () => {
    expect(shouldShowInstallAffordance({
      canInstall: true,
      isInstalled: false,
      platform: 'android',
    })).toBe(true)
    expect(shouldShowInstallAffordance({
      canInstall: false,
      isInstalled: false,
      platform: 'ios',
    })).toBe(true)
    expect(shouldShowInstallAffordance({
      canInstall: false,
      isInstalled: false,
      platform: 'desktop',
    })).toBe(true)
    expect(shouldShowInstallAffordance({
      canInstall: true,
      isInstalled: true,
      platform: 'android',
    })).toBe(false)
    expect(shouldShowInstallAffordance({
      canInstall: false,
      isInstalled: false,
      platform: 'desktop',
      dismissed: true,
    })).toBe(false)
    expect(INSTALL_AFFORDANCE_COPY.cta).toContain('Install')
    expect(INSTALL_AFFORDANCE_COPY.menuHint).toContain('browser menu')
    expect(installAffordancePath({ canInstall: true, platform: 'desktop' })).toBe('prompt')
    expect(installAffordancePath({ canInstall: false, platform: 'ios' })).toBe('ios')
    expect(installAffordancePath({ canInstall: false, platform: 'desktop' })).toBe('menu')
  })

  it('dismisses once and does not nag on Tonight or /n/capitol-hill', () => {
    const store = {
      data: {} as Record<string, string>,
      getItem(key: string) { return this.data[key] ?? null },
      setItem(key: string, value: string) { this.data[key] = value },
      removeItem(key: string) { delete this.data[key] },
      clear() { this.data = {} },
      key() { return null },
      length: 0,
    } as Storage
    expect(shouldShowInstallOnSurface({
      surface: 'tonight',
      canInstall: true,
      isInstalled: false,
      platform: 'android',
    })).toBe(true)
    expect(shouldShowInstallOnSurface({
      surface: 'map',
      canInstall: true,
      isInstalled: false,
      platform: 'android',
    })).toBe(false)
    dismissInstallAffordance(store)
    expect(store.getItem(INSTALL_DISMISS_STORAGE_KEY)).toBe('1')
    expect(isInstallAffordanceDismissed(store)).toBe(true)
    expect(shouldShowInstallOnSurface({
      surface: 'capitol-hill',
      canInstall: true,
      isInstalled: false,
      platform: 'ios',
      dismissed: true,
    })).toBe(false)
  })
})
