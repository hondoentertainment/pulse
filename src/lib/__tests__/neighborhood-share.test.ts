import { describe, expect, it } from 'vitest'
import {
  getNeighborhoodPrettyShareUrl,
  getNeighborhoodShareLandingPath,
  getNeighborhoodShareOgImageUrl,
  getNeighborhoodSharePreviewUrl,
  parseNeighborhoodShareSlug,
} from '../neighborhood-share'

const ORIGIN = 'https://pulse-chi-nine.vercel.app'

describe('neighborhood share + OG urls', () => {
  it('maps tagged /n slugs onto the existing share and OG path', () => {
    expect(parseNeighborhoodShareSlug('capitol-hill')).toBe('capitol-hill')
    expect(parseNeighborhoodShareSlug('Capitol Hill')).toBe('capitol-hill')
    expect(parseNeighborhoodShareSlug('west-seattle')).toBe('west-seattle')
    expect(parseNeighborhoodShareSlug('fremont')).toBe('fremont')
    expect(parseNeighborhoodShareSlug('portland')).toBeNull()
    expect(getNeighborhoodShareLandingPath('capitol-hill')).toBe('/n/capitol-hill')
    expect(getNeighborhoodPrettyShareUrl('capitol-hill', ORIGIN)).toBe(
      `${ORIGIN}/n/capitol-hill`,
    )
    expect(getNeighborhoodSharePreviewUrl('capitol-hill', ORIGIN)).toBe(
      `${ORIGIN}/api/share/venue?n=capitol-hill`,
    )
    expect(getNeighborhoodShareOgImageUrl('capitol-hill', ORIGIN)).toBe(
      `${ORIGIN}/api/share/og?n=capitol-hill`,
    )
  })
})
