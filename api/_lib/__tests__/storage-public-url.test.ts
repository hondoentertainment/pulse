import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { storageKeyToPublicUrl } from '../storage-public-url'

describe('storageKeyToPublicUrl', () => {
  const prevUrl = process.env.SUPABASE_URL
  const prevVite = process.env.VITE_SUPABASE_URL

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co'
    delete process.env.VITE_SUPABASE_URL
  })

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = prevUrl
    if (prevVite === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = prevVite
  })

  it('builds a public URL from a bare key', () => {
    expect(storageKeyToPublicUrl('user1/photos/a.jpg')).toBe(
      'https://proj.supabase.co/storage/v1/object/public/pulse-videos/user1/photos/a.jpg',
    )
  })

  it('strips a bucket prefix', () => {
    expect(storageKeyToPublicUrl('pulse-videos/user1/photos/a.jpg')).toBe(
      'https://proj.supabase.co/storage/v1/object/public/pulse-videos/user1/photos/a.jpg',
    )
  })

  it('rejects path traversal and odd characters', () => {
    expect(storageKeyToPublicUrl('../etc/passwd')).toBeNull()
    expect(storageKeyToPublicUrl('/absolute')).toBeNull()
    expect(storageKeyToPublicUrl('has space.jpg')).toBeNull()
  })
})
