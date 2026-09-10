import { describe, expect, it } from 'vitest'
import {
  clearPulseDraft,
  draftSnippet,
  isPulseDraftFresh,
  PULSE_DRAFT_STORAGE_KEY,
  readPulseDraft,
  writePulseDraft,
} from '../pulse-draft'

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

describe('pulse draft persistence', () => {
  it('round-trips a draft and clips caption to 120', () => {
    const store = memoryStore()
    writePulseDraft({
      venueId: 'neumos',
      energyRating: 'electric',
      caption: 'x'.repeat(200),
    }, store)
    const read = readPulseDraft(store)
    expect(read?.venueId).toBe('neumos')
    expect(read?.caption).toHaveLength(120)
    expect(store.getItem(PULSE_DRAFT_STORAGE_KEY)).toBeTruthy()
  })

  it('drops stale drafts', () => {
    const store = memoryStore()
    writePulseDraft({
      venueId: 'neumos',
      energyRating: 'chill',
      caption: 'old',
      updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    }, store)
    expect(readPulseDraft(store)).toBeNull()
  })

  it('clears and formats a queued snippet', () => {
    const store = memoryStore()
    const draft = writePulseDraft({
      venueId: 'neumos',
      energyRating: 'electric',
      caption: 'Floor packed. Don’t leave.',
    }, store)
    expect(isPulseDraftFresh(draft)).toBe(true)
    expect(draftSnippet(draft)).toContain('Floor packed')
    expect(draftSnippet(draft)).toContain('will post when online')
    clearPulseDraft(store)
    expect(readPulseDraft(store)).toBeNull()
  })
})
