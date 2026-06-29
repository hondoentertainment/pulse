/**
 * GDPR/CCPA account lifecycle helpers — export and deletion.
 *
 * Export uses the caller's JWT so RLS is the authorization boundary.
 * Deletion requires the service role to remove the auth.users row (cascades
 * to profiles and owned data via FK ON DELETE CASCADE).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ExportTableSpec = {
  key: string
  table: string
  column: string
  single?: boolean
  /** Field names to redact (replaced with `[REDACTED]`). */
  redactFields?: string[]
}

/** Tables owned by the user that RLS should expose for self-export. */
export const EXPORT_TABLES: ExportTableSpec[] = [
  { key: 'profile', table: 'profiles', column: 'id', single: true },
  { key: 'pulses', table: 'pulses', column: 'user_id' },
  { key: 'reactions', table: 'reactions', column: 'user_id' },
  { key: 'pulse_reactions', table: 'pulse_reactions', column: 'user_id' },
  { key: 'check_ins', table: 'check_ins', column: 'user_id' },
  { key: 'follows', table: 'follows', column: 'follower_id' },
  { key: 'notifications', table: 'notifications', column: 'user_id' },
  { key: 'emergency_contacts', table: 'emergency_contacts', column: 'user_id' },
  {
    key: 'push_tokens',
    table: 'push_tokens',
    column: 'user_id',
    redactFields: ['token'],
  },
  { key: 'signal_entries', table: 'signal_entries', column: 'user_id' },
]

export type AccountExportPayload = {
  exportedAt: string
  userId: string
  format: 'pulse-account-export-v1'
  data: Record<string, unknown>
  warnings: string[]
}

const redactRow = (
  row: Record<string, unknown>,
  fields: string[] | undefined,
): Record<string, unknown> => {
  if (!fields?.length) return row
  const copy = { ...row }
  for (const field of fields) {
    if (field in copy) copy[field] = '[REDACTED]'
  }
  return copy
}

async function fetchTableRows(
  client: SupabaseClient,
  spec: ExportTableSpec,
  userId: string,
): Promise<{ rows: unknown[]; warning?: string }> {
  if (spec.single) {
    const { data, error } = await client
      .from(spec.table)
      .select('*')
      .eq(spec.column, userId)
      .maybeSingle()

    if (error) {
      return { rows: [], warning: `${spec.table}: ${error.message}` }
    }

    const row = data as Record<string, unknown> | null
    return { rows: row ? [redactRow(row, spec.redactFields)] : [] }
  }

  const { data, error } = await client
    .from(spec.table)
    .select('*')
    .eq(spec.column, userId)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    return { rows: [], warning: `${spec.table}: ${error.message}` }
  }

  const rows = Array.isArray(data) ? data : []
  return {
    rows: rows.map(r => redactRow(r as Record<string, unknown>, spec.redactFields)),
  }
}

export async function exportUserData(
  client: SupabaseClient,
  userId: string,
): Promise<AccountExportPayload> {
  const data: Record<string, unknown> = {}
  const warnings: string[] = []

  for (const spec of EXPORT_TABLES) {
    const { rows, warning } = await fetchTableRows(client, spec, userId)
    if (warning) warnings.push(warning)
    data[spec.key] = spec.single ? (rows[0] ?? null) : rows
  }

  return {
    exportedAt: new Date().toISOString(),
    userId,
    format: 'pulse-account-export-v1',
    data,
    warnings,
  }
}

export async function softDeleteProfile(
  client: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deletedAt = new Date().toISOString()
  const { error } = await client
    .from('profiles')
    .update({ deleted_at: deletedAt })
    .eq('id', userId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteAuthUser(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export function validateDeleteConfirmation(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const confirm = (body as { confirm?: unknown }).confirm
  return confirm === 'DELETE'
}
