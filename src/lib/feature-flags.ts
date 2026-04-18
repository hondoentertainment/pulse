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
  // Ticketing: default off. Enabling requires Stripe keys + staff migration applied.
  ticketing: false,
}

export const featureFlags: FeatureFlagMap = {
  integrations: parseFlag(import.meta.env.VITE_FF_ENABLE_INTEGRATIONS, defaults.integrations),
  socialDashboard: parseFlag(import.meta.env.VITE_FF_ENABLE_SOCIAL_DASHBOARD, defaults.socialDashboard),
  smartMap: parseFlag(import.meta.env.VITE_FF_ENABLE_SMART_MAP, defaults.smartMap),
  ticketing: parseFlag(import.meta.env.VITE_FF_ENABLE_TICKETING, defaults.ticketing),
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}
