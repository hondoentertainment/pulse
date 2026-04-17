export type FeatureFlag = 'integrations' | 'socialDashboard' | 'smartMap' | 'ticketing'

type FeatureFlagMap = Record<FeatureFlag, boolean>

function parseFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const defaults: FeatureFlagMap = {
  integrations: true,
  socialDashboard: true,
  smartMap: true,
  // Stripe Connect ticketing/reservations scaffold is OFF by default —
  // existing flows stay on the mock payment layer until explicitly enabled.
  ticketing: false,
}

export const featureFlags: FeatureFlagMap = {
  integrations: parseFlag(import.meta.env.VITE_FF_ENABLE_INTEGRATIONS, defaults.integrations),
  socialDashboard: parseFlag(import.meta.env.VITE_FF_ENABLE_SOCIAL_DASHBOARD, defaults.socialDashboard),
  smartMap: parseFlag(import.meta.env.VITE_FF_ENABLE_SMART_MAP, defaults.smartMap),
  ticketing: parseFlag(import.meta.env.VITE_TICKETING_ENABLED, defaults.ticketing),
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}
