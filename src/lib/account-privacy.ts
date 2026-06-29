/**
 * Client helpers for GDPR/CCPA export and account deletion.
 */

import type { ApiClientOptions, ApiResult } from './api-client'

export type AccountExportResponse = {
  exportedAt: string
  userId: string
  format: string
  data: Record<string, unknown>
  warnings: string[]
}

export type AccountDeleteResponse = {
  deleted: boolean
  userId: string
}

function buildHeaders(opts?: ApiClientOptions): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts?.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`
  return headers
}

function apiPath(path: string, opts?: ApiClientOptions): string {
  const base = opts?.baseUrl ?? ''
  return `${base}${path}`
}

async function parseJson<T>(response: Response): Promise<ApiResult<T>> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // empty body
  }
  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : `Request failed (${response.status})`
    return { ok: false, status: response.status, error }
  }
  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? ((payload as { data: T }).data)
      : (payload as T)
  return { ok: true, data }
}

export async function fetchAccountExport(
  opts: ApiClientOptions = {},
): Promise<ApiResult<AccountExportResponse>> {
  const res = await fetch(apiPath('/api/account/export', opts), {
    method: 'GET',
    headers: buildHeaders(opts),
    signal: opts.signal,
  })
  return parseJson<AccountExportResponse>(res)
}

export async function requestAccountDeletion(
  opts: ApiClientOptions = {},
): Promise<ApiResult<AccountDeleteResponse>> {
  const res = await fetch(apiPath('/api/account/delete', opts), {
    method: 'POST',
    headers: buildHeaders(opts),
    body: JSON.stringify({ confirm: 'DELETE' }),
    signal: opts.signal,
  })
  return parseJson<AccountDeleteResponse>(res)
}

export function downloadJsonBlob(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function buildLocalExportFallback(user: Record<string, unknown>): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    format: 'pulse-local-export-v1',
    note: 'Offline/demo export — sign in with Supabase for a full server export.',
    user,
  }
}
