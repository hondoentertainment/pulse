import { describe, expect, it } from 'vitest'
import { ALPHABET, generateCode, generateUniqueCode } from '../referral-code-gen'

describe('generateCode', () => {
  it('produces a 6-char code by default', () => {
    const code = generateCode()
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('uses only the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      for (const ch of code) {
        expect(ALPHABET).toContain(ch)
      }
    }
  })

  it('supports 6-8 char lengths', () => {
    expect(generateCode(6)).toHaveLength(6)
    expect(generateCode(7)).toHaveLength(7)
    expect(generateCode(8)).toHaveLength(8)
  })

  it('rejects out-of-range lengths', () => {
    expect(() => generateCode(5)).toThrow()
    expect(() => generateCode(9)).toThrow()
  })
})

describe('generateCode collision safety at scale', () => {
  it('does not produce an unreasonable number of duplicates across 10k samples', () => {
    const seen = new Set<string>()
    let dupes = 0
    for (let i = 0; i < 10_000; i++) {
      const c = generateCode(6)
      if (seen.has(c)) dupes++
      else seen.add(c)
    }
    // With a 32^6 ~ 1.07B codespace and 10k draws the birthday paradox
    // collision expectation is << 0.1. We allow a generous 5 to avoid flakes.
    expect(dupes).toBeLessThan(5)
  })
})

describe('generateUniqueCode', () => {
  it('returns a code that passes the exists() check', async () => {
    const used = new Set<string>()
    const code = await generateUniqueCode(async (c) => used.has(c))
    expect(code).toMatch(/^[A-Z0-9]{6,8}$/)
  })

  it('avoids an already-used code', async () => {
    const banned = new Set<string>(['ABCDEF'])
    // Most calls won't hit ABCDEF. Run many iterations to confirm the
    // function reliably avoids the banned value.
    for (let i = 0; i < 500; i++) {
      // eslint-disable-next-line no-await-in-loop
      const code = await generateUniqueCode(async (c) => banned.has(c))
      expect(code).not.toBe('ABCDEF')
    }
  })

  it('escalates length on repeated collisions', async () => {
    let calls = 0
    // Always-collide for the first 4 calls at length 6, then succeed.
    const exists = async (c: string) => {
      calls++
      if (calls < 5) return true
      return c.length < 7
    }
    const code = await generateUniqueCode(exists, { startLength: 6, maxAttempts: 10 })
    expect(code.length).toBeGreaterThanOrEqual(7)
  })

  it('throws after exceeding maxAttempts', async () => {
    await expect(
      generateUniqueCode(async () => true, { maxAttempts: 3 })
    ).rejects.toThrow(/collision-free/i)
  })
})
