import { describe, expect, it } from 'vitest'
import {
  FOCUS_HOOD_NAME,
  focusHoodDensityLabel,
  focusHoodEmptyBody,
  focusHoodSeedVenues,
} from '../focus-hood'

describe('focus hood', () => {
  it('keeps Capitol Hill as the only density wedge and lists launch rooms', () => {
    const seeds = focusHoodSeedVenues()
    expect(FOCUS_HOOD_NAME).toBe('Capitol Hill')
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds.every((venue) => venue.neighborhood === 'Capitol Hill')).toBe(true)
    expect(seeds.some((venue) => venue.name === 'Neumos')).toBe(true)
    expect(focusHoodDensityLabel('Capitol Hill')).toMatch(/^Focus hood · \d+ launch rooms$/)
    expect(focusHoodDensityLabel('Ballard')).toBeNull()
    expect(focusHoodEmptyBody()).toMatch(/Capitol Hill/)
  })
})
