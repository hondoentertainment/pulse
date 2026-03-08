import { describe, it, expect } from 'vitest'
import {
  buildImageUrl,
  getResponsiveImage,
  getVideoThumbnail,
  getAvatarUrl,
} from '../cdn-optimizer'

describe('buildImageUrl', () => {
  it('adds quality parameter by default', () => {
    const url = buildImageUrl('https://img.example.com/photo.jpg')
    expect(url).toContain('q=80')
  })

  it('adds width and height', () => {
    const url = buildImageUrl('https://img.example.com/photo.jpg', { width: 400, height: 300 })
    expect(url).toContain('w=400')
    expect(url).toContain('h=300')
  })

  it('adds format', () => {
    const url = buildImageUrl('https://img.example.com/photo.jpg', { format: 'webp' })
    expect(url).toContain('fm=webp')
  })

  it('handles existing query params', () => {
    const url = buildImageUrl('https://img.example.com/photo.jpg?v=1', { width: 200 })
    expect(url).toContain('&w=200')
  })

  it('returns empty for empty src', () => {
    expect(buildImageUrl('')).toBe('')
  })
})

describe('getResponsiveImage', () => {
  it('generates srcSet and sizes', () => {
    const result = getResponsiveImage('https://img.example.com/photo.jpg')
    expect(result.srcSet).toContain('320w')
    expect(result.srcSet).toContain('640w')
    expect(result.sizes).toBeDefined()
    expect(result.placeholder).toContain('blur=20')
  })

  it('respects maxWidth', () => {
    const result = getResponsiveImage('https://img.example.com/photo.jpg', { maxWidth: 400 })
    expect(result.srcSet).toContain('320w')
    expect(result.srcSet).not.toContain('640w')
  })
})

describe('getVideoThumbnail', () => {
  it('generates thumbnail URL', () => {
    const url = getVideoThumbnail('https://cdn.example.com/video.mp4')
    expect(url).toContain('w=640')
    expect(url).toContain('t=1')
    expect(url).toContain('fm=jpg')
  })
})

describe('getAvatarUrl', () => {
  it('returns sized avatar URL', () => {
    const small = getAvatarUrl('https://img.example.com/avatar.jpg', 'small')
    expect(small).toContain('w=48')
    expect(small).toContain('h=48')

    const large = getAvatarUrl('https://img.example.com/avatar.jpg', 'large')
    expect(large).toContain('w=256')
  })

  it('returns empty for undefined src', () => {
    expect(getAvatarUrl(undefined)).toBe('')
  })
})
