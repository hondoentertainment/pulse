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
  // Differentiator pack — all default on (safe, no API keys required).
  weatherBoost: true,
  waitTime: true,
  accessibilityFilter: true,
  // Safety kit — default on in dev via env.example; in prod it's gated on
  // having Twilio env vars.
  safetyKit: true,
  // Ticketing & AI concierge — default OFF (require env configuration).
  ticketing: false,
  aiConcierge: false,
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
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}
