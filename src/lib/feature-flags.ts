export type FeatureFlag =
  | 'integrations'
  | 'socialDashboard'
  | 'smartMap'
  | 'weatherBoost'
  | 'waitTime'
  | 'accessibilityFilter'
  | 'safetyKit'
  | 'ticketing'
  | 'aiConcierge'
  | 'vibeVision'
  | 'creatorEconomy'

type FeatureFlagMap = Record<FeatureFlag, boolean>

function parseFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const isProdBuild = import.meta.env.PROD

const defaults: FeatureFlagMap = {
  integrations: true,
  // Social pulse admin dashboard — off for public venue launch polish.
  socialDashboard: !isProdBuild,
  smartMap: true,
  // Differentiator pack — all default on (safe, no API keys required).
  weatherBoost: true,
  waitTime: true,
  accessibilityFilter: true,
  // Safety kit / ticketing / AI / creators — off until explicitly enabled.
  safetyKit: false,
  ticketing: false,
  aiConcierge: false,
  // Photo → energy vibe assessment (Anthropic vision); off until keyed.
  vibeVision: false,
  creatorEconomy: false,
}

export const featureFlags: FeatureFlagMap = {
  integrations: parseFlag(import.meta.env.VITE_FF_ENABLE_INTEGRATIONS, defaults.integrations),
  socialDashboard: parseFlag(import.meta.env.VITE_FF_ENABLE_SOCIAL_DASHBOARD, defaults.socialDashboard),
  smartMap: parseFlag(import.meta.env.VITE_FF_ENABLE_SMART_MAP, defaults.smartMap),
  weatherBoost: parseFlag(import.meta.env.VITE_WEATHER_BOOST_ENABLED, defaults.weatherBoost),
  waitTime: parseFlag(import.meta.env.VITE_WAIT_TIME_ENABLED, defaults.waitTime),
  accessibilityFilter: parseFlag(
    import.meta.env.VITE_ACCESSIBILITY_FILTER_ENABLED,
    defaults.accessibilityFilter,
  ),
  safetyKit: parseFlag(import.meta.env.VITE_SAFETY_KIT_ENABLED, defaults.safetyKit),
  ticketing: parseFlag(import.meta.env.VITE_TICKETING_ENABLED, defaults.ticketing),
  aiConcierge: parseFlag(import.meta.env.VITE_AI_CONCIERGE_ENABLED, defaults.aiConcierge),
  vibeVision: parseFlag(import.meta.env.VITE_VIBE_VISION_ENABLED, defaults.vibeVision),
  creatorEconomy: parseFlag(import.meta.env.VITE_CREATOR_ECONOMY_ENABLED, defaults.creatorEconomy),
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}
