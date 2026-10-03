import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import { evaluateLocalNightCoach } from '../local-night-coach'

function venue(): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.61, lng: -122.32, address: '' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
  }
}

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

describe('local night coach', () => {
  it('shows an 8pm digest once, then a 9pm quiet note when Surging is empty', () => {
    const store = memoryStore()
    const eight = evaluateLocalNightCoach({
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['neumos'],
      now: new Date('2026-09-14T03:10:00.000Z'),
      store,
    })
    expect(eight?.kind).toBe('digest')
    expect(eight?.title).toMatch(/Quiet|Live/)

    const eightAgain = evaluateLocalNightCoach({
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['neumos'],
      now: new Date('2026-09-14T03:20:00.000Z'),
      store,
    })
    expect(eightAgain).toBeNull()

    const nine = evaluateLocalNightCoach({
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['neumos'],
      now: new Date('2026-09-14T04:10:00.000Z'),
      store,
    })
    expect(nine?.kind).toBe('quiet')
    expect(nine?.body).toMatch(/Be the first/)
  })
})
