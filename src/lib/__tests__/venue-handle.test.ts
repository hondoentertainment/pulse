import { describe, expect, it } from 'vitest'
import { authorHandle, displayInitials, venueHandle } from '../venue-handle'

describe('venueHandle', () => {
  it('slugs a venue name as an X-style handle', () => {
    expect(venueHandle('Neumos')).toBe('@neumos')
    expect(venueHandle('Capitol Hill')).toBe('@capitolhill')
    expect(venueHandle("Linda's Tavern")).toBe('@lindastavern')
  })

  it('falls back without inventing a venue', () => {
    expect(venueHandle('')).toBe('@venue')
    expect(venueHandle(undefined)).toBe('@venue')
  })
})

describe('authorHandle', () => {
  it('uses the pulse author when present', () => {
    expect(authorHandle('kyle', 'Neumos')).toBe('@kyle')
    expect(authorHandle('@you', 'Neumos')).toBe('@you')
  })

  it('falls back to the venue handle', () => {
    expect(authorHandle('', 'Neumos')).toBe('@neumos')
    expect(authorHandle(undefined, 'Neumos')).toBe('@neumos')
  })
})

describe('displayInitials', () => {
  it('uses one or two letters from the display name', () => {
    expect(displayInitials('Neumos')).toBe('NE')
    expect(displayInitials('Capitol Hill')).toBe('CH')
    expect(displayInitials('')).toBe('?')
  })
})
