import { describe, it, expect } from 'vitest'
import { sanitizeHTML, sanitizeUserInput, sanitizeHashtag } from '../sanitize'

describe('sanitizeHTML', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHTML('')).toBe('')
  })

  it('preserves plain text', () => {
    expect(sanitizeHTML('Hello world')).toBe('Hello world')
  })

  it('preserves safe formatting tags', () => {
    const input = '<b>bold</b> and <em>italic</em>'
    expect(sanitizeHTML(input)).toBe(input)
  })

  it('removes script tags', () => {
    expect(sanitizeHTML('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('removes script tags case-insensitively', () => {
    expect(sanitizeHTML('<SCRIPT>alert("xss")</SCRIPT>')).toBe('alert("xss")')
  })

  it('removes iframe tags', () => {
    expect(sanitizeHTML('<iframe src="evil.com"></iframe>')).toBe('')
  })

  it('removes event handler attributes', () => {
    expect(sanitizeHTML('<img onerror="alert(1)" src="x">')).toBe('<img src="x">')
  })

  it('removes onclick attributes', () => {
    expect(sanitizeHTML('<div onclick="alert(1)">text</div>')).toBe('<div>text</div>')
  })

  it('removes javascript: protocol in href', () => {
    const result = sanitizeHTML('<a href="javascript:alert(1)">click</a>')
    expect(result).not.toContain('javascript:')
    expect(result).toContain('click')
  })

  it('removes object, embed, and form tags', () => {
    expect(sanitizeHTML('<object data="x"></object>')).toBe('')
    expect(sanitizeHTML('<embed src="x">')).toBe('')
    expect(sanitizeHTML('<form action="x"><input></form>')).toBe('')
  })

  it('removes style tags', () => {
    expect(sanitizeHTML('<style>body { display: none }</style>')).toBe('body { display: none }')
  })

  it('removes expression() in styles', () => {
    const result = sanitizeHTML('color: expression(alert(1))')
    expect(result).not.toContain('expression(')
  })

  it('handles nested dangerous content', () => {
    const input = '<b>safe<script>evil()</script>also safe</b>'
    expect(sanitizeHTML(input)).toBe('<b>safeevil()also safe</b>')
  })
})

describe('sanitizeUserInput', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeUserInput('')).toBe('')
  })

  it('trims whitespace', () => {
    expect(sanitizeUserInput('  hello  ')).toBe('hello')
  })

  it('removes control characters', () => {
    expect(sanitizeUserInput('hello\x00world')).toBe('helloworld')
    expect(sanitizeUserInput('test\x01\x02\x03')).toBe('test')
  })

  it('preserves normal whitespace (tabs, newlines)', () => {
    expect(sanitizeUserInput('line1\nline2\ttab')).toBe('line1\nline2\ttab')
  })

  it('collapses excessive newlines', () => {
    expect(sanitizeUserInput('a\n\n\n\n\n\nb')).toBe('a\n\n\nb')
  })

  it('enforces max length', () => {
    const long = 'a'.repeat(10000)
    expect(sanitizeUserInput(long).length).toBe(5000)
  })

  it('respects custom max length', () => {
    expect(sanitizeUserInput('hello world', 5)).toBe('hello')
  })

  it('handles strings within max length', () => {
    expect(sanitizeUserInput('short', 1000)).toBe('short')
  })
})

describe('sanitizeHashtag', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHashtag('')).toBe('')
  })

  it('preserves valid hashtags', () => {
    expect(sanitizeHashtag('#hello')).toBe('#hello')
    expect(sanitizeHashtag('#hello_world')).toBe('#hello_world')
    expect(sanitizeHashtag('#test123')).toBe('#test123')
  })

  it('adds # prefix if missing', () => {
    expect(sanitizeHashtag('hello')).toBe('#hello')
  })

  it('removes special characters', () => {
    expect(sanitizeHashtag('#hello@world!')).toBe('#helloworld')
    expect(sanitizeHashtag('#café')).toBe('#caf')
  })

  it('removes spaces', () => {
    expect(sanitizeHashtag('#hello world')).toBe('#helloworld')
  })

  it('handles only special characters', () => {
    expect(sanitizeHashtag('#@!$')).toBe('')
  })

  it('enforces max length of 100 characters', () => {
    const long = '#' + 'a'.repeat(150)
    const result = sanitizeHashtag(long)
    // # plus 100 chars
    expect(result.length).toBe(101)
  })

  it('trims whitespace', () => {
    expect(sanitizeHashtag('  #hello  ')).toBe('#hello')
  })
})
