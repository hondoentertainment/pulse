import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLocalPreference } from '../use-local-preference'

describe('useLocalPreference', () => {
  beforeEach(() => localStorage.clear())

  it('persists a market across mounts', () => {
    const first = renderHook(() => useLocalPreference<string>('market', 'seattle'))
    act(() => first.result.current[1]('miami'))
    first.unmount()
    const second = renderHook(() => useLocalPreference<string>('market', 'seattle'))
    expect(second.result.current[0]).toBe('miami')
  })

  it('ignores malformed and wrong-type stored values', () => {
    localStorage.setItem('onboarding', '"false"')
    expect(renderHook(() => useLocalPreference('onboarding', false)).result.current[0]).toBe(false)
    localStorage.setItem('market', '{invalid')
    expect(renderHook(() => useLocalPreference('market', 'seattle')).result.current[0]).toBe('seattle')
  })
})
