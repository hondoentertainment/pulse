/**
 * Tiny validation helpers for Edge Function payloads.
 *
 * We intentionally avoid importing zod/yup here — Edge Functions should boot
 * fast and have zero runtime deps beyond what Vercel provides. These helpers
 * mirror a subset of zod semantics (string, enum, object) sufficient for the
 * current endpoints. Add more shapes as needed, not speculatively.
 */

export type ValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] }

export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export const asString = (
  value: unknown,
  field: string,
  opts: { maxLength?: number; minLength?: number; trim?: boolean } = {},
): ValidateResult<string> => {
  if (typeof value !== 'string') {
    return { ok: false, errors: [`${field} must be a string`] }
  }
  const normalised = opts.trim ? value.trim() : value
  if (opts.minLength !== undefined && normalised.length < opts.minLength) {
    return {
      ok: false,
      errors: [`${field} must be at least ${opts.minLength} characters`],
    }
  }
  if (opts.maxLength !== undefined && normalised.length > opts.maxLength) {
    return {
      ok: false,
      errors: [`${field} must be at most ${opts.maxLength} characters`],
    }
  }
  return { ok: true, value: normalised }
}

export const asEnum = <T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): ValidateResult<T> => {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    return {
      ok: false,
      errors: [`${field} must be one of: ${allowed.join(', ')}`],
    }
  }
  return { ok: true, value: value as T }
}

export const combine = <T extends Record<string, unknown>>(
  results: { [K in keyof T]: ValidateResult<T[K]> },
): ValidateResult<T> => {
  const errors: string[] = []
  const value: Partial<T> = {}
  for (const key of Object.keys(results) as (keyof T)[]) {
    const r = results[key]
    if (r.ok) {
      value[key] = r.value
    } else {
      errors.push(...r.errors)
    }
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: value as T }
}
