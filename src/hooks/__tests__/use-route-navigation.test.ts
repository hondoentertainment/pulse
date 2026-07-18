import { describe, it, expect } from 'vitest'
import { deriveActiveTab, deriveSubPage, isTabPath } from '@/hooks/use-route-navigation'

describe('deriveActiveTab', () => {
  it('maps main tab paths to their tab id', () => {
    expect(deriveActiveTab('/')).toBe('trending')
    expect(deriveActiveTab('/discover')).toBe('discover')
    expect(deriveActiveTab('/map')).toBe('map')
    expect(deriveActiveTab('/notifications')).toBe('notifications')
    expect(deriveActiveTab('/profile')).toBe('profile')
    expect(deriveActiveTab('/video')).toBe('video')
  })

  it('falls back to trending for sub-pages and unknown paths', () => {
    expect(deriveActiveTab('/events')).toBe('trending')
    expect(deriveActiveTab('/venue/abc')).toBe('trending')
    expect(deriveActiveTab('/nope')).toBe('trending')
  })
})

describe('isTabPath', () => {
  it('is true only for main tab routes', () => {
    expect(isTabPath('/')).toBe(true)
    expect(isTabPath('/map')).toBe(true)
    expect(isTabPath('/events')).toBe(false)
    expect(isTabPath('/venue/abc')).toBe(false)
    expect(isTabPath('/unknown')).toBe(false)
  })
})

describe('deriveSubPage', () => {
  it('maps sub-page paths to their key', () => {
    expect(deriveSubPage('/events')).toBe('events')
    expect(deriveSubPage('/settings')).toBe('settings')
    expect(deriveSubPage('/night-planner')).toBe('night-planner')
    expect(deriveSubPage('/my-tickets')).toBe('my-tickets')
  })

  it('returns null for tab routes, venue routes, and unknown paths', () => {
    expect(deriveSubPage('/')).toBeNull()
    expect(deriveSubPage('/map')).toBeNull()
    expect(deriveSubPage('/venue/abc')).toBeNull()
    expect(deriveSubPage('/nope')).toBeNull()
  })
})
