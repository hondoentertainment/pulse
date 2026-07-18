import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  absoluteUrl,
  shortlistDocumentMeta,
  venueDocumentMeta,
  setDocumentMeta,
  resetDocumentMeta,
} from '../document-meta'

describe('document-meta', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('builds venue share meta', () => {
    const meta = venueDocumentMeta({
      name: 'Neon Room',
      city: 'Seattle',
      category: 'Club',
      energyLabel: 'Buzzing',
      confidence: 'High',
      venueId: 'v1',
    })
    expect(meta.title).toBe('Neon Room')
    expect(meta.description).toContain('Buzzing')
    expect(meta.url).toContain('/venue/v1')
  })

  it('builds shortlist meta from venue names', () => {
    const meta = shortlistDocumentMeta(['A', 'B', 'C', 'D'])
    expect(meta.title).toContain('shortlist')
    expect(meta.description).toContain('+1 more')
  })

  it('absoluteUrl joins origin', () => {
    expect(absoluteUrl('/x', 'https://pulse.app')).toBe('https://pulse.app/x')
    expect(absoluteUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
  })

  it('setDocumentMeta writes title and og tags', () => {
    setDocumentMeta({
      title: 'Test Venue',
      description: 'A great spot',
      url: 'https://pulse.app/venue/t',
    })
    expect(document.title).toContain('Test Venue')
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toContain(
      'Test Venue',
    )
    resetDocumentMeta()
    expect(document.title).toContain('Pulse')
  })
})
