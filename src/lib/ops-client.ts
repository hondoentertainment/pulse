/**
 * Lightweight ops client for /ops — verify claims + triage pulse_reports
 * without raw SQL when the user has app_metadata.role === 'admin'.
 */

import { supabase } from '@/lib/supabase'

export interface OpsClaimRow {
  id: string
  venue_id: string
  status: 'pending' | 'verified' | 'rejected'
  created_at: string
  venue_name: string | null
  neighborhood: string | null
}

export interface OpsReportRow {
  id: string
  pulse_id: string
  reporter_id: string
  reason: string
  details: string | null
  created_at: string
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  reviewed_at: string | null
}

/** Owner inbox report. Who filed it is not part of this row. */
export interface VenueOpsReportRow {
  id: string
  pulse_id: string
  reason: string
  details: string | null
  created_at: string
  status: OpsReportRow['status']
  reviewed_at: string | null
}

function toOpsClaimRow(value: unknown): OpsClaimRow {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const status = row.status
  return {
    id: typeof row.id === 'string' ? row.id : '',
    venue_id: typeof row.venue_id === 'string' ? row.venue_id : '',
    status: status === 'verified' || status === 'rejected' ? status : 'pending',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    venue_name: typeof row.venue_name === 'string' ? row.venue_name : null,
    neighborhood: typeof row.neighborhood === 'string' ? row.neighborhood : null,
  }
}

function toVenueReportRow(value: unknown): VenueOpsReportRow {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const status = row.status
  return {
    id: typeof row.id === 'string' ? row.id : '',
    pulse_id: typeof row.pulse_id === 'string' ? row.pulse_id : '',
    reason: typeof row.reason === 'string' ? row.reason : '',
    details: typeof row.details === 'string' ? row.details : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    status: status === 'reviewed' || status === 'actioned' || status === 'dismissed' || status === 'pending'
      ? status
      : 'pending',
    reviewed_at: typeof row.reviewed_at === 'string' ? row.reviewed_at : null,
  }
}

async function authHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in with an admin account to use /ops')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } | string }
    if (typeof body.error === 'string') return body.error
    if (body.error?.message) return body.error.message
  } catch {
    /* keep fallback */
  }
  return fallback
}

export async function listOpsClaims(status = 'pending'): Promise<OpsClaimRow[]> {
  const headers = await authHeader()
  const res = await fetch(`/api/admin/venue-claims?status=${encodeURIComponent(status)}`, { headers })
  if (!res.ok) throw new Error(await readError(res, 'Could not list claims'))
  const json = (await res.json()) as { data?: { claims?: unknown[] } }
  return (json.data?.claims ?? []).map(toOpsClaimRow)
}

export async function decideOpsClaim(input: {
  claimId: string
  status: 'verified' | 'rejected'
  notes?: string
}): Promise<void> {
  const headers = await authHeader()
  const res = await fetch('/api/admin/venue-claims', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'Could not update claim'))
}

export async function listOpsReports(): Promise<OpsReportRow[]> {
  const headers = await authHeader()
  const res = await fetch('/api/pulses/report?scope=all', { headers })
  if (!res.ok) throw new Error(await readError(res, 'Could not list reports'))
  const json = (await res.json()) as { data?: { reports?: OpsReportRow[] } }
  return json.data?.reports ?? []
}

export async function updateOpsReport(input: {
  reportId: string
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  reason?: string
}): Promise<void> {
  const headers = await authHeader()
  const res = await fetch('/api/pulses/report', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'Could not update report'))
}

export async function dismissReportsForPulseOnServer(pulseId: string): Promise<boolean> {
  try {
    const headers = await authHeader()
    const res = await fetch('/api/pulses/report', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ pulseId, status: 'dismissed' }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Owner inbox: reports for pulses at this venue (403 → []). Omits who filed each report. */
export async function listVenueReportsOnServer(venueId: string): Promise<VenueOpsReportRow[]> {
  try {
    const headers = await authHeader()
    const res = await fetch(`/api/pulses/report?venueId=${encodeURIComponent(venueId)}`, { headers })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: { reports?: unknown[] } }
    return (json.data?.reports ?? []).map(toVenueReportRow)
  } catch {
    return []
  }
}

export function isAdminSession(session: {
  user?: {
    app_metadata?: Record<string, unknown>
    role?: string
  }
} | null | undefined): boolean {
  const appRole = session?.user?.app_metadata?.role
  const role = (typeof appRole === 'string' ? appRole : undefined) ?? session?.user?.role
  return role === 'admin'
}
