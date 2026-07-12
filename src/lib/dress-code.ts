import type { VenueDressCode } from './types'

export const LIVE_DRESS_CODES = [
  'casual',
  'smart_casual',
  'upscale',
  'formal',
  'costume_required',
  'no_code',
] as const satisfies readonly VenueDressCode[]

export type LiveDressCode = VenueDressCode

const LEGACY_MAP: Record<string, VenueDressCode> = {
  casual: 'casual',
  'smart-casual': 'smart_casual',
  smart_casual: 'smart_casual',
  dressy: 'upscale',
  upscale: 'upscale',
  formal: 'formal',
  costume_required: 'costume_required',
  'costume-required': 'costume_required',
  no_code: 'no_code',
  'no-code': 'no_code',
}

/** Normalize live or static dress-code tokens to the canonical VenueDressCode. */
export function normalizeDressCode(value: unknown): VenueDressCode | null {
  if (typeof value !== 'string') return null
  const key = value.trim().toLowerCase()
  return LEGACY_MAP[key] ?? null
}

export const DRESS_CODE_OPTIONS: { label: string; value: VenueDressCode }[] = [
  { label: 'Casual', value: 'casual' },
  { label: 'Smart Casual', value: 'smart_casual' },
  { label: 'Upscale', value: 'upscale' },
  { label: 'Formal', value: 'formal' },
  { label: 'Costume Required', value: 'costume_required' },
  { label: 'No Code', value: 'no_code' },
]

export function formatDressCodeLabel(code: VenueDressCode | string | null | undefined): string {
  const normalized = normalizeDressCode(code)
  if (!normalized) return 'Unknown'
  return DRESS_CODE_OPTIONS.find((o) => o.value === normalized)?.label ?? normalized
}
