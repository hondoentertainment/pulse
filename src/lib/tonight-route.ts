import type { EnergyRating } from './types'

export type TonightVibeParam = EnergyRating | 'any'

export function buildTonightPath(vibe?: TonightVibeParam | null): string {
  if (!vibe || vibe === 'any') return '/'
  return `/?vibe=${encodeURIComponent(vibe)}`
}

export function parseTonightVibeParam(
  value: string | null | undefined,
  allowed: readonly TonightVibeParam[],
): TonightVibeParam {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as TonightVibeParam
  }
  return 'any'
}
