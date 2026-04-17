/**
 * Lightweight validation helpers.
 *
 * Avoids a dep (zod, yup) for Edge Function bundle size. If you need more
 * elaborate schemas, promote to `zod` — it's already on the client.
 */

export type Validator<T> = (value: unknown) => value is T

export const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

export const isNonNegativeInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

export const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

export const isUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime())
}

export interface ValidationError {
  field: string
  message: string
}

export const requireFields = (
  value: unknown,
  rules: Record<string, (v: unknown) => boolean>,
): ValidationError[] => {
  const errors: ValidationError[] = []
  if (!value || typeof value !== 'object') {
    errors.push({ field: '_root', message: 'body must be an object' })
    return errors
  }
  const body = value as Record<string, unknown>
  for (const [field, check] of Object.entries(rules)) {
    if (!check(body[field])) {
      errors.push({ field, message: `invalid ${field}` })
    }
  }
  return errors
}
