import { describe, it, expect, beforeEach } from 'vitest'
import {
  t,
  setLocale,
  getLocale,
  getDirection,
  isRTL,
  getAvailableLocales,
  formatNumber,
  formatRelativeTime,
} from '../i18n'

beforeEach(() => {
  setLocale('en')
})

describe('t (translate)', () => {
  it('returns English translations by default', () => {
    expect(t('nav.trending')).toBe('Trending')
    expect(t('energy.electric')).toBe('Electric')
  })

  it('returns key when translation missing', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('interpolates params', () => {
    expect(t('notif.friend_pulse', { name: 'Alice', venue: 'Bar X' }))
      .toBe('Alice posted a pulse at Bar X')
  })

  it('handles pluralization', () => {
    expect(t('social.friends', { count: 1 })).toBe('1 friend')
    expect(t('social.friends', { count: 5 })).toBe('5 friends')
  })

  it('switches locale', () => {
    setLocale('es')
    expect(t('nav.trending')).toBe('Tendencias')
    expect(t('energy.electric')).toBe('Electrizante')
  })

  it('falls back to English for missing translations', () => {
    setLocale('ja')
    // 'action.share' not in ja, should fall back to en
    expect(t('action.share')).toBe('Share')
  })
})

describe('getDirection', () => {
  it('returns ltr for English', () => {
    expect(getDirection('en')).toBe('ltr')
  })

  it('returns rtl for Arabic', () => {
    expect(getDirection('ar')).toBe('rtl')
  })
})

describe('isRTL', () => {
  it('returns false for English', () => {
    setLocale('en')
    expect(isRTL()).toBe(false)
  })

  it('returns true for Arabic', () => {
    setLocale('ar')
    expect(isRTL()).toBe(true)
  })
})

describe('getAvailableLocales', () => {
  it('includes major locales', () => {
    const locales = getAvailableLocales()
    expect(locales.length).toBeGreaterThanOrEqual(5)
    expect(locales.find(l => l.code === 'en')?.name).toBe('English')
    expect(locales.find(l => l.code === 'ar')?.name).toBe('العربية')
  })
})

describe('formatNumber', () => {
  it('formats numbers', () => {
    setLocale('en')
    expect(formatNumber(1234)).toBe('1,234')
  })
})

describe('formatRelativeTime', () => {
  it('formats just now', () => {
    expect(formatRelativeTime(new Date())).toBe('Just now')
  })

  it('formats minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinAgo)).toContain('5')
    expect(formatRelativeTime(fiveMinAgo)).toContain('min')
  })

  it('formats hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHoursAgo)).toContain('2')
    expect(formatRelativeTime(twoHoursAgo)).toContain('hour')
  })
})
