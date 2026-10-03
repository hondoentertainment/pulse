/**
 * WC-7 reporter hide is synchronous. The network persist can follow.
 * Admin reasons live in api/_lib/moderation-sla.ts and are re-exported here.
 */

import { createReport, type ReportReason } from '@/lib/content-moderation'

export { moderationResolution } from '../../api/_lib/moderation-sla'

const REPORT_REASONS = new Set<ReportReason>([
  'spam',
  'inappropriate',
  'harassment',
  'misinformation',
  'fake_location',
  'hide',
  'other',
])

function asReportReason(reason: string): ReportReason {
  return REPORT_REASONS.has(reason as ReportReason) ? (reason as ReportReason) : 'other'
}

/**
 * Drop the reported pulse from the reporter's list in the same turn.
 * Callers pass the reporter's own list. Other viewers keep using
 * filterModeratedPulses, which ignores reports they did not file.
 */
export function hidePulseForReporter<T extends { id: string }>(
  pulses: readonly T[],
  reporterId: string,
  pulseId: string,
  reason: string,
): T[] {
  if (!reporterId || !pulseId) return [...pulses]
  const report = createReport(reporterId, 'pulse', pulseId, asReportReason(reason))
  if (report.reporterId !== reporterId || report.targetId !== pulseId) return [...pulses]
  return pulses.filter((pulse) => pulse.id !== pulseId)
}
