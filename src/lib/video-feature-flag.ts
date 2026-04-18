/**
 * Video-feed feature flag.
 *
 * Separate module (rather than extending `feature-flags.ts`) so that:
 *   1. We don't modify the existing feature-flag surface.
 *   2. The import graph stays clean — the flag is read at route-lazy time,
 *      so no video code enters the main chunk when the flag is off.
 */

function parse(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

export function isVideoFeedEnabled(): boolean {
  const env =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: Record<string, unknown> }).env
      : undefined
  return parse(env?.VITE_VIDEO_FEED_ENABLED, false)
}
