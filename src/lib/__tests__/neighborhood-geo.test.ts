import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAUNCH_NEIGHBORHOOD,
  inferNeighborhoodFromGeo,
  persistHomePlace,
  readSavedNeighborhood,
  resolveNeighborhoodFallback,
} from '../neighborhood-geo'

function memoryStore(): Storage {
  const data: Record<string, string> = {}
  return {
    get length() { return Object.keys(data).length },
    clear() { for (const key of Object.keys(data)) delete data[key] },
    getItem(key) { return data[key] ?? null },
    key(index) { return Object.keys(data)[index] ?? null },
    removeItem(key) { delete data[key] },
    setItem(key, value) { data[key] = value },
  }
}

describe('neighborhood geo', () => {
  it('infers Capitol Hill from a Neumos-like point', () => {
    expect(inferNeighborhoodFromGeo({ lat: 47.6145, lng: -122.3205 })).toBe('Capitol Hill')
    expect(inferNeighborhoodFromGeo({ lat: 47.668, lng: -122.383 })).toBe('Ballard')
    expect(inferNeighborhoodFromGeo({ lat: 10, lng: 10 })).toBeNull()
  })

  it('falls back to Launch 33 / saved hood when location is denied', () => {
    expect(resolveNeighborhoodFallback({})).toBe(DEFAULT_LAUNCH_NEIGHBORHOOD)
    expect(resolveNeighborhoodFallback({ savedNeighborhood: 'Fremont' })).toBe('Fremont')
    const store = memoryStore()
    persistHomePlace({ neighborhood: 'Belltown', city: 'Seattle' }, store)
    expect(readSavedNeighborhood(store)).toBe('Belltown')
  })
})
