import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDailyCentsCap,
  loadDailySpend,
  recordDailySpend,
  resetVibeAssessCostMemory,
  utcDayKey,
} from '../vibe-assess-cost'

describe('vibe-assess-cost', () => {
  beforeEach(() => {
    resetVibeAssessCostMemory()
    delete process.env.VIBE_VISION_DAILY_CENTS_CAP
  })

  it('defaults daily cap to 50 cents', () => {
    expect(getDailyCentsCap()).toBe(50)
  })

  it('honours env override', () => {
    process.env.VIBE_VISION_DAILY_CENTS_CAP = '12.5'
    expect(getDailyCentsCap()).toBe(12.5)
  })

  it('accumulates in-memory spend when Supabase is unavailable', async () => {
    const day = utcDayKey()
    const a = await recordDailySpend({
      userId: 'user-1',
      userJwt: 'jwt',
      costCents: 2.5,
    })
    expect(a.day).toBe(day)
    expect(a.requestCount).toBe(1)
    expect(a.spentCents).toBe(2.5)

    const b = await recordDailySpend({
      userId: 'user-1',
      userJwt: 'jwt',
      costCents: 1,
      lowConfidence: true,
    })
    expect(b.requestCount).toBe(2)
    expect(b.spentCents).toBe(3.5)

    const loaded = await loadDailySpend('user-1', 'jwt')
    expect(loaded.spentCents).toBe(3.5)
  })
})
