import { describe, it, expect } from 'vitest'
import { buildLocalExportFallback } from '../account-privacy'

describe('buildLocalExportFallback', () => {
  it('wraps user data with export metadata', () => {
    const payload = buildLocalExportFallback({ username: 'nightowl' })
    expect(payload.format).toBe('pulse-local-export-v1')
    expect(payload.user).toEqual({ username: 'nightowl' })
    expect(typeof payload.exportedAt).toBe('string')
    expect(String(payload.note)).toMatch(/offline/i)
  })
})
