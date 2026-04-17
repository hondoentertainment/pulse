/**
 * Tiny request-body validators. Shaped to be ergonomic for Edge Functions;
 * no schema library dependency.
 */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function requireString(value: unknown, label: string, maxLen = 2048): ValidationResult<string> {
  if (!isString(value)) return { ok: false, error: `${label} must be a string` }
  if (value.length === 0) return { ok: false, error: `${label} must not be empty` }
  if (value.length > maxLen) return { ok: false, error: `${label} exceeds ${maxLen} chars` }
  return { ok: true, value }
}

export function requireArray<T>(
  value: unknown,
  label: string,
  maxItems: number,
  itemValidator: (v: unknown, idx: number) => ValidationResult<T>,
): ValidationResult<T[]> {
  if (!Array.isArray(value)) return { ok: false, error: `${label} must be an array` }
  if (value.length > maxItems) return { ok: false, error: `${label} exceeds ${maxItems} items` }
  const out: T[] = []
  for (let i = 0; i < value.length; i++) {
    const r = itemValidator(value[i], i)
    if (!r.ok) return { ok: false, error: `${label}[${i}]: ${r.error}` }
    out.push(r.value)
  }
  return { ok: true, value: out }
}

/** Approx byte size via UTF-8 encoder. */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length
}
