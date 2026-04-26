/**
 * Harness test for the server-side moderation module.
 *
 * The module lives at `api/_lib/moderation.ts` but is pure — no Edge runtime
 * globals, no I/O — so vitest can exercise it directly. Importing via relative
 * path keeps these tests portable to any future test runner targeting
 * api/ specifically.
 */

import { describe, it, expect } from 'vitest'
import { checkContent } from '../../../api/_lib/moderation'

describe('checkContent (server)', () => {
  it('allows clean pulse caption', () => {
    const r = checkContent({ content: 'Great vibes tonight!', kind: 'pulse' })
    expect(r.allowed).toBe(true)
    expect(r.reasons).toEqual([])
    expect(r.severity).toBe('low')
  })

  it('allows empty pulse caption (photo-only)', () => {
    const r = checkContent({ content: '', kind: 'pulse' })
    expect(r.allowed).toBe(true)
  })

  it('blocks banned phrases at high severity', () => {
    const r = checkContent({ content: 'buy now for free money', kind: 'pulse' })
    expect(r.allowed).toBe(false)
    expect(r.severity).toBe('high')
    expect(r.reasons.some((x) => x.toLowerCase().includes('buy now'))).toBe(true)
  })

  it('flags emails in pulses as medium severity', () => {
    const r = checkContent({ content: 'hit me up at foo@bar.com', kind: 'pulse' })
    expect(r.allowed).toBe(false)
    expect(r.severity).toBe('med')
    expect(r.sanitized).toContain('[redacted-email]')
  })

  it('allows phone in venue_description (legitimate context)', () => {
    const r = checkContent({
      content: 'Call us at 415-555-1234 for reservations',
      kind: 'venue_description',
    })
    // Phone is allowed for venue_description; no other issues.
    expect(r.allowed).toBe(true)
  })

  it('blocks phone in comment', () => {
    const r = checkContent({
      content: 'text me 415-555-1234',
      kind: 'comment',
    })
    expect(r.allowed).toBe(false)
    expect(r.sanitized).toContain('[redacted-phone]')
  })

  it('blocks high-risk TLDs at high severity', () => {
    const r = checkContent({
      content: 'check out http://scam.example.ru/foo',
      kind: 'pulse',
    })
    expect(r.allowed).toBe(false)
    expect(r.severity).toBe('high')
  })

  it('flags non-allowlisted URLs as medium', () => {
    const r = checkContent({
      content: 'see https://random-example.com/page',
      kind: 'pulse',
    })
    expect(r.allowed).toBe(false)
    expect(r.severity).toBe('med')
  })

  it('allows allowlisted URLs', () => {
    const r = checkContent({
      content: 'follow https://instagram.com/pulse',
      kind: 'pulse',
    })
    expect(r.allowed).toBe(true)
  })

  it('enforces max length per kind', () => {
    const long = 'a'.repeat(501)
    const r = checkContent({ content: long, kind: 'pulse' })
    expect(r.allowed).toBe(false)
    expect(r.reasons.some((x) => x.includes('maximum length'))).toBe(true)
  })

  it('rejects unknown kind as high severity', () => {
    // @ts-expect-error deliberately invalid
    const r = checkContent({ content: 'hi', kind: 'unknown' })
    expect(r.allowed).toBe(false)
    expect(r.severity).toBe('high')
  })

  it('flags excessive uppercase at low severity', () => {
    const r = checkContent({
      content: 'ABCDEFGHIJKLMN vibes',
      kind: 'pulse',
    })
    expect(r.reasons.some((x) => x.toLowerCase().includes('uppercase'))).toBe(true)
    // Only low-severity issues -> still allowed.
    expect(r.severity).toBe('low')
    expect(r.allowed).toBe(true)
  })

  it('sanitizes PII in the returned sanitized field', () => {
    const r = checkContent({
      content: 'Email me foo@bar.com or 415-555-1234',
      kind: 'comment',
    })
    expect(r.sanitized).not.toContain('foo@bar.com')
    expect(r.sanitized).not.toContain('415-555-1234')
  })
})
