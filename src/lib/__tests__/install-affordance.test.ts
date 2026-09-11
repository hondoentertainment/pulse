import { describe, expect, it } from 'vitest'
import {
  INSTALL_AFFORDANCE_COPY,
  installAffordancePath,
  shouldShowInstallAffordance,
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
})
