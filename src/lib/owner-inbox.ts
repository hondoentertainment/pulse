/**
 * Owner inbox v2 — reply + dismiss for verified venue claims.
 * Actions persist locally (and via callbacks) so owners can work tonight's queue.
 */

import type { ContentReport, ReportReason } from './content-moderation'
import type { Pulse } from './types'
import { getTonightLiveReviews } from './live-reviews'

export const OWNER_INBOX_REPLY_STORAGE_KEY = 'pulse_owner_inbox_replies_v1'
export const OWNER_INBOX_DISMISS_STORAGE_KEY = 'pulse_owner_inbox_dismissals_v1'

export interface OwnerInboxReply {
  id: string
  pulseId: string
  venueId: string
  body: string
  createdAt: string
}

export interface OwnerInboxDismissal {
  pulseId: string
  venueId: string
  dismissedAt: string
}

export function countTonightReports(
  reports: ContentReport[],
  tonightPulses: Pulse[],
): number {
  const pulseIds = new Set(tonightPulses.map((pulse) => pulse.id))
  return reports.filter((report) => (
    report.targetType === 'pulse'
    && pulseIds.has(report.targetId)
    && report.status !== 'dismissed'
  )).length
}

export function reportsForPulse(
  reports: ContentReport[],
  pulseId: string,
): ContentReport[] {
  return reports.filter((report) => (
    report.targetType === 'pulse'
    && report.targetId === pulseId
    && report.status !== 'dismissed'
  ))
}

export function dismissReportsForPulse(
  reports: ContentReport[],
  pulseId: string,
  nowIso: string = new Date().toISOString(),
): ContentReport[] {
  return reports.map((report) => {
    if (report.targetType !== 'pulse' || report.targetId !== pulseId) return report
    if (report.status === 'dismissed') return report
    return { ...report, status: 'dismissed', reviewedAt: nowIso, actionTaken: 'none' }
  })
}

export function createOwnerReply(input: {
  pulseId: string
  venueId: string
  body: string
  nowIso?: string
}): OwnerInboxReply | null {
  const body = input.body.trim()
  if (body.length < 1 || body.length > 280) return null
  return {
    id: `reply-${input.pulseId}-${Date.now()}`,
    pulseId: input.pulseId,
    venueId: input.venueId,
    body,
    createdAt: input.nowIso ?? new Date().toISOString(),
  }
}

export function summarizeOwnerInbox(input: {
  pulses: Pulse[]
  venueId: string
  reports: ContentReport[]
  now?: Date
}): { reviewCount: number; reportCount: number; tonight: Pulse[] } {
  const tonight = getTonightLiveReviews(input.pulses, input.venueId, input.now)
  return {
    reviewCount: tonight.length,
    reportCount: countTonightReports(input.reports, tonight),
    tonight,
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadOwnerReplies(): OwnerInboxReply[] {
  return readJson<OwnerInboxReply[]>(OWNER_INBOX_REPLY_STORAGE_KEY, [])
}

export function persistOwnerReply(reply: OwnerInboxReply): OwnerInboxReply[] {
  const next = [reply, ...loadOwnerReplies().filter((row) => row.id !== reply.id)]
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(OWNER_INBOX_REPLY_STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function loadOwnerDismissals(): OwnerInboxDismissal[] {
  return readJson<OwnerInboxDismissal[]>(OWNER_INBOX_DISMISS_STORAGE_KEY, [])
}

export function persistOwnerDismissal(dismissal: OwnerInboxDismissal): OwnerInboxDismissal[] {
  const next = [
    dismissal,
    ...loadOwnerDismissals().filter((row) => !(row.pulseId === dismissal.pulseId && row.venueId === dismissal.venueId)),
  ]
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(OWNER_INBOX_DISMISS_STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function isPulseDismissed(
  dismissals: OwnerInboxDismissal[],
  pulseId: string,
  venueId: string,
): boolean {
  return dismissals.some((row) => row.pulseId === pulseId && row.venueId === venueId)
}

const REPORT_REASONS: readonly ReportReason[] = [
  'spam',
  'inappropriate',
  'harassment',
  'misinformation',
  'fake_location',
  'other',
]

export interface PulseReportLike {
  id: string
  pulse_id: string
  reporter_id: string
  reason: string
  details?: string | null
  created_at: string
  status?: string | null
  reviewed_at?: string | null
}

export function mapPulseReportsToContentReports(
  rows: readonly PulseReportLike[],
): ContentReport[] {
  return rows.map((row) => {
    const reason = REPORT_REASONS.includes(row.reason as ReportReason)
      ? (row.reason as ReportReason)
      : 'other'
    const status = row.status === 'reviewed'
      || row.status === 'actioned'
      || row.status === 'dismissed'
      ? row.status
      : 'pending'
    return {
      id: row.id,
      reporterId: row.reporter_id,
      targetType: 'pulse',
      targetId: row.pulse_id,
      reason,
      description: row.details?.trim() || undefined,
      createdAt: row.created_at,
      status,
      reviewedAt: row.reviewed_at ?? undefined,
    }
  })
}

/** Server rows win on id; dismissed status wins so a local dismiss stays visible. */
export function mergeInboxReports(
  server: readonly ContentReport[],
  local: readonly ContentReport[],
): ContentReport[] {
  const byId = new Map<string, ContentReport>()
  for (const row of [...server, ...local]) {
    const existing = byId.get(row.id)
    if (!existing) {
      byId.set(row.id, row)
      continue
    }
    if (row.status === 'dismissed' && existing.status !== 'dismissed') {
      byId.set(row.id, row)
    }
  }
  return [...byId.values()]
}
