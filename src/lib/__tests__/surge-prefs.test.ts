import { describe, expect, it } from 'vitest'
import {
  isVenueSurgeMuted,
  parseQuietHours,
  writeQuietHours,
  writeVenueSurgeMuted,
} from '../surge-prefs'

function memoryStore() {
  const data: Record<string, string> = {}
  return {
    getItem(key: string) { return data[key] ?? null },
    setItem(key: string, value: string) { data[key] = value },
  }
}

describe('surge prefs', () => {
  it('stores quiet hours and per-venue mute locally', () => {
    const store = memoryStore()
    expect(parseQuietHours(null)).toEqual({ start: null, end: null })
    writeQuietHours({ start: 22, end: 7 }, store)
    expect(parseQuietHours(store.getItem('pulse:surge-quiet-hours'))).toEqual({ start: 22, end: 7 })
    expect(writeVenueSurgeMuted('neumos', true, store)).toBe(true)
    expect(isVenueSurgeMuted('neumos', store)).toBe(true)
    writeVenueSurgeMuted('neumos', false, store)
    expect(isVenueSurgeMuted('neumos', store)).toBe(false)
  })
})
