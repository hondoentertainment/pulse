export type ScoutTier = 'rookie' | 'regular' | 'lead'
export type ScoutApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface ScoutTierConfig {
  tier: ScoutTier
  label: string
  weeklyQuota: number
  description: string
}

export const SCOUT_TIERS: Record<ScoutTier, ScoutTierConfig> = {
  rookie: {
    tier: 'rookie',
    label: 'Rookie Scout',
    weeklyQuota: 3,
    description: 'New scout — up to 3 verified reports per week.',
  },
  regular: {
    tier: 'regular',
    label: 'Regular Scout',
    weeklyQuota: 7,
    description: 'Trusted scout — up to 7 verified reports per week.',
  },
  lead: {
    tier: 'lead',
    label: 'Lead Scout',
    weeklyQuota: 14,
    description: 'Lead scout — up to 14 verified reports per week.',
  },
}

export interface ScoutApplication {
  id: string
  userId: string
  status: ScoutApplicationStatus
  tier: ScoutTier
  motivation?: string
  neighborhoods: string[]
  reviewedAt?: string
  createdAt: string
}

export function getScoutWeeklyQuota(tier: ScoutTier | null | undefined): number {
  if (!tier) return 0
  return SCOUT_TIERS[tier]?.weeklyQuota ?? 0
}

export function canSubmitScoutReport(
  tier: ScoutTier | null | undefined,
  reportsThisWeek: number,
): boolean {
  const quota = getScoutWeeklyQuota(tier)
  if (quota === 0) return false
  return reportsThisWeek < quota
}

export function defaultTierForApproval(): ScoutTier {
  return 'rookie'
}

export function isValidScoutTier(value: string): value is ScoutTier {
  return value === 'rookie' || value === 'regular' || value === 'lead'
}
