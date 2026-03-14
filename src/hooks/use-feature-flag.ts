import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags'

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag)
}
