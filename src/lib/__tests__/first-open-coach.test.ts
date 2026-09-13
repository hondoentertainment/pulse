import { describe, expect, it } from 'vitest'
import {
  dismissFirstOpenCoach,
  FIRST_OPEN_COACH_LINE,
  FIRST_OPEN_COACH_STORAGE_KEY,
  shouldShowFirstOpenCoach,
} from '../first-open-coach'

function memoryStore(initial: Record<string, string> = {}): Storage {
  const data = { ...initial }
  return {
    get length() { return Object.keys(data).length },
    clear() { for (const key of Object.keys(data)) delete data[key] },
    getItem(key: string) { return data[key] ?? null },
    key(index: number) { return Object.keys(data)[index] ?? null },
    removeItem(key: string) { delete data[key] },
    setItem(key: string, value: string) { data[key] = value },
  }
}

describe('first-open coach', () => {
  it('teaches what’s live tonight and how to pulse', () => {
    expect(FIRST_OPEN_COACH_LINE).toContain('Tonight')
    expect(FIRST_OPEN_COACH_LINE).toMatch(/I’m here · Pulse|I'm here · Pulse/)
  })

  it('shows once until dismissed in localStorage', () => {
    const store = memoryStore()
    expect(shouldShowFirstOpenCoach(store)).toBe(true)
    dismissFirstOpenCoach(store)
    expect(store.getItem(FIRST_OPEN_COACH_STORAGE_KEY)).toBe('1')
    expect(shouldShowFirstOpenCoach(store)).toBe(false)
  })
})
