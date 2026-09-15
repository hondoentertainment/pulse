import { describe, expect, it } from 'vitest'
import { venueCoverOgImage, venueCoverUrl } from '../venue-cover'

describe('venue cover', () => {
  it('uses an existing catalog URL and never invents one', () => {
    expect(venueCoverUrl({ image_url: 'https://cdn.example/neumos.jpg' })).toBe('https://cdn.example/neumos.jpg')
    expect(venueCoverUrl({ imageUrl: 'https://cdn.example/barrio.jpg' })).toBe('https://cdn.example/barrio.jpg')
    expect(venueCoverUrl({ hours: { friday: '9pm' } })).toBeNull()
    expect(venueCoverUrl({ image_url: 'not-a-url' })).toBeNull()
    expect(venueCoverOgImage({}, 'https://app/og.svg')).toBe('https://app/og.svg')
    expect(venueCoverOgImage({ photo_url: 'https://cdn.example/x.jpg' }, 'https://app/og.svg')).toBe(
      'https://cdn.example/x.jpg',
    )
  })
})
