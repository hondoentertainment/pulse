import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMMISSION_RATE,
  ATTRIBUTION_WINDOW_MS,
  computeCommissionCents,
  isSelfReferral,
  isWithinAttributionWindow,
  pickMostRecentPending,
} from '../referral-attribution'

describe('computeCommissionCents', () => {
  it('applies the default 10% rate', () => {
    expect(computeCommissionCents(10000)).toBe(1000)
  })

  it('rounds to the nearest cent', () => {
    // 1234 * 0.10 = 123.4 -> 123
    expect(computeCommissionCents(1234)).toBe(123)
    // 1235 * 0.10 = 123.5 -> 124 (banker rounds 124 with Math.round)
    expect(computeCommissionCents(1235)).toBe(124)
  })

  it('honors a custom rate', () => {
    expect(computeCommissionCents(10000, 0.15)).toBe(1500)
  })

  it('returns 0 for invalid inputs', () => {
    expect(computeCommissionCents(-1)).toBe(0)
    expect(computeCommissionCents(0)).toBe(0)
    expect(computeCommissionCents(Number.NaN)).toBe(0)
    expect(computeCommissionCents(100, 0)).toBe(0)
    expect(computeCommissionCents(100, -0.1)).toBe(0)
  })

  it('never returns a negative number', () => {
    expect(computeCommissionCents(100, 1e-12)).toBeGreaterThanOrEqual(0)
  })
})

describe('isSelfReferral', () => {
  it('is true when ids match', () => {
    expect(isSelfReferral('u1', 'u1')).toBe(true)
  })
  it('is false otherwise', () => {
    expect(isSelfReferral('u1', 'u2')).toBe(false)
  })
})

describe('isWithinAttributionWindow', () => {
  const now = new Date('2026-04-17T12:00:00Z').getTime()

  it('accepts an event 1 day old', () => {
    const created = new Date(now - 24 * 60 * 60 * 1000).toISOString()
    expect(isWithinAttributionWindow(created, now)).toBe(true)
  })

  it('accepts an event 30 days old (boundary)', () => {
    const created = new Date(now - ATTRIBUTION_WINDOW_MS).toISOString()
    expect(isWithinAttributionWindow(created, now)).toBe(true)
  })

  it('rejects an event 31 days old', () => {
    const created = new Date(now - ATTRIBUTION_WINDOW_MS - 1).toISOString()
    expect(isWithinAttributionWindow(created, now)).toBe(false)
  })

  it('rejects future-dated events (clock skew defense)', () => {
    const created = new Date(now + 1000).toISOString()
    expect(isWithinAttributionWindow(created, now)).toBe(false)
  })

  it('rejects invalid date strings', () => {
    expect(isWithinAttributionWindow('not-a-date', now)).toBe(false)
  })
})

describe('pickMostRecentPending', () => {
  const now = new Date('2026-04-17T12:00:00Z').getTime()
  const base = (partial: Partial<Parameters<typeof pickMostRecentPending>[0][number]>) =>
    ({
      id: 'x',
      code: 'C',
      referred_user_id: 'u',
      created_at: new Date(now - 60_000).toISOString(),
      status: 'pending',
      ...partial,
    }) as Parameters<typeof pickMostRecentPending>[0][number]

  it('returns null when empty', () => {
    expect(pickMostRecentPending([], now)).toBeNull()
  })

  it('picks the most recent pending row', () => {
    const picked = pickMostRecentPending(
      [
        base({ id: 'old', created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() }),
        base({ id: 'new', created_at: new Date(now - 60_000).toISOString() }),
      ],
      now
    )
    expect(picked?.id).toBe('new')
  })

  it('skips non-pending rows', () => {
    const picked = pickMostRecentPending(
      [
        base({ id: 'a', status: 'held' }),
        base({ id: 'b', status: 'paid' }),
      ],
      now
    )
    expect(picked).toBeNull()
  })

  it('skips rows outside the window', () => {
    const picked = pickMostRecentPending(
      [base({ id: 'old', created_at: new Date(now - ATTRIBUTION_WINDOW_MS - 1000).toISOString() })],
      now
    )
    expect(picked).toBeNull()
  })
})

describe('DEFAULT_COMMISSION_RATE', () => {
  it('is exactly 10%', () => {
    expect(DEFAULT_COMMISSION_RATE).toBe(0.1)
  })
})
