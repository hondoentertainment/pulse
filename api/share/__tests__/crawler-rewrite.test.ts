import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('share crawler rewrites', () => {
  it('serves venue Open Graph to the same bots as neighborhood share links', () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      rewrites: Array<{
        source: string
        destination: string
        has?: Array<{ type: string; key: string; value: string }>
      }>
    }
    const neighborhood = vercel.rewrites.find((rule) => rule.source === '/n/:slug')
    const venue = vercel.rewrites.find((rule) => rule.source === '/venue/:venueId')
    const catchAll = vercel.rewrites.findIndex((rule) => rule.source === '/(.*)')
    expect(neighborhood?.has?.[0]?.value).toMatch(/Slackbot/)
    expect(neighborhood?.has?.[0]?.value).toMatch(/Applebot/)
    expect(venue?.destination).toBe('/api/share/venue?venueId=:venueId')
    expect(venue?.has?.[0]?.value).toBe(neighborhood?.has?.[0]?.value)
    expect(vercel.rewrites.findIndex((rule) => rule.source === '/venue/:venueId')).toBeLessThan(catchAll)
  })
})