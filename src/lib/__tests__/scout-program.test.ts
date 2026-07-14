import { describe, it, expect } from 'vitest'
import {
  SCOUT_TIERS,
  canSubmitScoutReport,
  getScoutWeeklyQuota,
  isValidScoutTier,
} from '../scout-program'

describe('scout program quotas', () => {
  it('returns zero quota for non-scouts', () => {
    expect(getScoutWeeklyQuota(null)).toBe(0)
    expect(getScoutWeeklyQuota(undefined)).toBe(0)
  })

  it('returns tier-specific weekly quotas', () => {
    expect(getScoutWeeklyQuota('rookie')).toBe(SCOUT_TIERS.rookie.weeklyQuota)
    expect(getScoutWeeklyQuota('lead')).toBe(SCOUT_TIERS.lead.weeklyQuota)
  })

  it('blocks reports when quota is exhausted', () => {
    expect(canSubmitScoutReport('rookie', 2)).toBe(true)
    expect(canSubmitScoutReport('rookie', 3)).toBe(false)
    expect(canSubmitScoutReport(null, 0)).toBe(false)
  })
})

describe('isValidScoutTier', () => {
  it('accepts known tiers', () => {
    expect(isValidScoutTier('regular')).toBe(true)
  })

  it('rejects unknown tiers', () => {
    expect(isValidScoutTier('vip')).toBe(false)
  })
})
