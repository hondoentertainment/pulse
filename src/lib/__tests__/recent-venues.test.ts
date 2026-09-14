import { describe, expect, it } from 'vitest'
import {
  listRecentVenues,
  readRecentVenueIds,
  RECENT_VENUES_CAP,
  RECENT_VENUES_STORAGE_KEY,
  rememberOpenedVenue,
  sanitizeRecentVenueId,
} from '../recent-venues'

function memoryStore(seed: Record<string, string> = {}): Storage {
  const data: Record<string, string> = { ...seed }
  return {
    get length() { return Object.keys(data).length },
    clear() { for (const key of Object.keys(data)) delete data[key] },
    getItem(key) { return data[key] ?? null },
    key(index) { return Object.keys(data)[index] ?? null },
    removeItem(key) { delete data[key] },
    setItem(key, value) { data[key] = value },
  }
}

describe('recent venues', () => {
  it('keeps the last 5 opened venue ids in localStorage without inventing rooms', () => {
    const store = memoryStore()
    expect(sanitizeRecentVenueId('https://evil.example/x')).toBeNull()
    expect(sanitizeRecentVenueId('venue/1')).toBeNull()
    expect(rememberOpenedVenue('neumos', store)).toEqual(['neumos'])
    expect(rememberOpenedVenue('sunset', store)).toEqual(['sunset', 'neumos'])
    expect(rememberOpenedVenue('neumos', store)).toEqual(['neumos', 'sunset'])
    rememberOpenedVenue('a', store)
    rememberOpenedVenue('b', store)
    rememberOpenedVenue('c', store)
    rememberOpenedVenue('d', store)
    expect(readRecentVenueIds(store)).toEqual(['d', 'c', 'b', 'a', 'neumos'])
    expect(readRecentVenueIds(store)).toHaveLength(RECENT_VENUES_CAP)
    expect(JSON.parse(store.getItem(RECENT_VENUES_STORAGE_KEY) ?? '[]')).toHaveLength(5)

    const venues = [
      { id: 'neumos', name: 'Neumos' },
      { id: 'sunset', name: 'Sunset' },
      { id: 'missing', name: 'Ghost' },
    ]
    expect(listRecentVenues(venues, ['sunset', 'ghost', 'neumos']).map((row) => row.id)).toEqual([
      'sunset',
      'neumos',
    ])
  })

  it('survives junk storage and missing localStorage', () => {
    expect(readRecentVenueIds(null)).toEqual([])
    expect(readRecentVenueIds(memoryStore({ [RECENT_VENUES_STORAGE_KEY]: 'nope' }))).toEqual([])
    expect(rememberOpenedVenue('  ', memoryStore())).toEqual([])
  })
})
