import { describe, it, expect, vi } from 'vitest'
import { dataUrlToBlob, mimeFromFormat, requestPhotoUploadUrl } from '../photo-client'
import { vibeTagsToHashtagNames } from '../vibe-assess-client'
import { photosForPulseSubmit } from '../vibe-photo-flow'

describe('photo-client helpers', () => {
  it('maps formats to mime types', () => {
    expect(mimeFromFormat('png')).toBe('image/png')
    expect(mimeFromFormat('webp')).toBe('image/webp')
    expect(mimeFromFormat('unknown')).toBe('image/jpeg')
  })

  it('converts a tiny data URL to a blob', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const blob = dataUrlToBlob(dataUrl)
    expect(blob).not.toBeNull()
    expect(blob?.type).toBe('image/png')
    expect(blob?.size).toBeGreaterThan(0)
  })

  it('parses a successful upload-url response', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            bucket: 'pulse-videos',
            path: 'u1/photos/x.jpg',
            signedUrl: 'https://signed.example/up',
            publicUrl: 'https://cdn.example/x.jpg',
            mime: 'image/jpeg',
            maxBytes: 8_000_000,
            expiresAt: new Date().toISOString(),
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch

    const result = await requestPhotoUploadUrl(
      { filename: 'x.jpg', mime: 'image/jpeg', bytes: 100 },
      { fetchImpl, authToken: 'tok' },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.path).toBe('u1/photos/x.jpg')
    }
  })
})

describe('vibeTagsToHashtagNames', () => {
  it('pascal-cases kebab tags', () => {
    expect(vibeTagsToHashtagNames(['packed-bar', '#craft-cocktails', 'dj'])).toEqual([
      'PackedBar',
      'CraftCocktails',
      'Dj',
    ])
  })
})

describe('photosForPulseSubmit', () => {
  it('prefers storageKey', () => {
    expect(
      photosForPulseSubmit({
        previewUrl: 'data:image/jpeg;base64,xxx',
        storageKey: 'u1/photos/a.jpg',
        publicUrl: 'https://cdn.example/a.jpg',
      }),
    ).toEqual(['u1/photos/a.jpg'])
  })

  it('returns empty for oversized data URLs without upload', () => {
    expect(
      photosForPulseSubmit({
        previewUrl: `data:image/jpeg;base64,${'a'.repeat(3000)}`,
        storageKey: null,
        publicUrl: null,
      }),
    ).toEqual([])
  })
})
