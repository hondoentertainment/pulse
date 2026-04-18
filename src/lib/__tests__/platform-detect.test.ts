import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isNative, getPlatformName } from '@/lib/platform/detect'

describe('platform detection', () => {
  const original = (globalThis as unknown as { Capacitor?: unknown }).Capacitor

  afterEach(() => {
    ;(globalThis as unknown as { Capacitor?: unknown }).Capacitor = original
  })

  beforeEach(() => {
    delete (globalThis as unknown as { Capacitor?: unknown }).Capacitor
  })

  it('reports web when Capacitor is absent', () => {
    expect(isNative()).toBe(false)
    expect(getPlatformName()).toBe('web')
  })

  it('reports native when Capacitor.isNativePlatform returns true', () => {
    ;(globalThis as unknown as { Capacitor: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
    }
    expect(isNative()).toBe(true)
    expect(getPlatformName()).toBe('ios')
  })

  it('reports android when Capacitor.getPlatform returns android', () => {
    ;(globalThis as unknown as { Capacitor: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    }
    expect(getPlatformName()).toBe('android')
  })
})
