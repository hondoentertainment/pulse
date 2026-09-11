import { describe, expect, it } from 'vitest'
import {
  INSTALL_AFFORDANCE_COPY,
  shouldShowInstallAffordance,
} from '../install-affordance'

describe('install affordance', () => {
  it('shows on Android/desktop when the browser can install', () => {
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
      canInstall: true,
      isInstalled: true,
      platform: 'android',
    })).toBe(false)
    expect(INSTALL_AFFORDANCE_COPY.cta).toContain('Install')
  })
})
