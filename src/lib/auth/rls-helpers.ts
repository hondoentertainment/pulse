/**
 * RLS-aware query helpers.
 *
 * These utilities wrap the Supabase client so that:
 *  - soft-deleted rows are filtered out by default
 *  - user-scoped queries consistently attach `user_id = auth.uid()` filters
 *  - write errors from RLS are normalised into a typed error we can surface
 *    in the UI
 *
 * Prefer composing these helpers over dropping raw `.select()` chains in
 * feature modules — it keeps the filter policy consistent as we migrate
 * off mock data.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId, AuthRequiredError } from './require-auth'
import type { PostgrestError } from '@supabase/postgrest-js'

export class RlsDeniedError extends Error {
  code = 'RLS_DENIED' as const
  cause?: PostgrestError
  constructor(message: string, cause?: PostgrestError) {
    super(message)
    this.name = 'RlsDeniedError'
    this.cause = cause
  }
}

/**
 * Build a SELECT query for a table that has a soft-delete column.
 * Pass `includeDeleted: true` only from admin paths.
 *
 * Returns the raw Supabase builder so callers can chain `.eq`, `.order`,
 * `.limit`, etc. The return type is intentionally `any` — Supabase's
 * generated builder types aren't useful without a full Database generic.
 */
export function fromAlive(
  table: string,
  columns = '*',
  opts: { includeDeleted?: boolean } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const builder = supabase.from(table).select(columns)
  if (opts.includeDeleted) return builder
  return builder.is('deleted_at', null)
}

/**
 * Select rows owned by the current user. Throws AuthRequiredError if the
 * caller is not signed in — use this only for authed data views.
 *
 *   const { data } = await selectOwnedBy('notifications', 'user_id', '*')
 */
export async function selectOwnedBy(
  table: string,
  ownerColumn: string,
  columns = '*',
  opts: { includeDeleted?: boolean } = {},
) {
  const userId = await requireUserId()
  return fromAlive(table, columns, opts).eq(ownerColumn, userId)
}

/**
 * Update rows owned by the current user. The helper attaches
 * `ownerColumn = auth.uid()` so even if RLS is misconfigured the query
 * won't accidentally touch other users' data.
 */
export async function updateOwnedBy(
  table: string,
  ownerColumn: string,
  patch: Record<string, unknown>,
) {
  const userId = await requireUserId()
  return supabase
    .from(table)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq(ownerColumn, userId)
}

/**
 * Soft-delete rows owned by the current user by stamping `deleted_at`.
 * Returns the typed Supabase result so callers can handle errors locally.
 */
export async function softDeleteOwnedBy(
  table: string,
  ownerColumn: string,
  id: string,
) {
  const userId = await requireUserId()
  return supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq(ownerColumn, userId)
}

/**
 * Shape we accept from any Supabase call. We deliberately keep the generic
 * loose — Supabase's typed builders return `unknown` or `GenericStringError`
 * in many paths, and forcing a narrow T here would require every call-site
 * to assert. Callers pass the expected row type as the type argument.
 */
export interface SupabaseResult {
  data: unknown
  error: PostgrestError | null
}

/**
 * Normalise a Supabase write result. Throws RlsDeniedError on 42501 (the
 * Postgres code for insufficient_privilege / RLS denial) and
 * AuthRequiredError on 401-ish shapes. Returns the unwrapped data otherwise.
 */
export function unwrap<T>(result: SupabaseResult): T {
  const { data, error } = result
  if (error) {
    if (error.code === '42501') {
      throw new RlsDeniedError(
        'You do not have permission to perform this action.',
        error,
      )
    }
    if (error.code === 'PGRST301' || error.message?.toLowerCase().includes('jwt')) {
      throw new AuthRequiredError()
    }
    throw Object.assign(new Error(error.message), { cause: error })
  }
  if (data === null || data === undefined) {
    throw new Error('No data returned from query.')
  }
  return data as T
}

/**
 * Same as `unwrap` but returns `null` for missing single rows instead of
 * throwing. Matches the semantics of `.maybeSingle()`.
 */
export function unwrapMaybe<T>(result: SupabaseResult): T | null {
  const { data, error } = result
  if (error) {
    if (error.code === 'PGRST116') return null
    if (error.code === '42501') {
      throw new RlsDeniedError(
        'You do not have permission to perform this action.',
        error,
      )
    }
    throw Object.assign(new Error(error.message), { cause: error })
  }
  return (data ?? null) as T | null
}
