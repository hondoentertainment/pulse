/**
 * Moderation Library
 *
 * Types and functions for content reporting and moderation actions.
 * Stores data in memory; intended to be backed by a database/API in production.
 */

export type ContentType = 'pulse' | 'reaction' | 'story'

export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other'

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned'

export type ModerationActionType = 'warn' | 'remove_content' | 'temp_ban' | 'permanent_ban'

export interface ContentReport {
  id: string
  reporterId: string
  contentType: ContentType
  contentId: string
  reason: ReportReason
  description?: string
  createdAt: string
  status: ReportStatus
}

export interface ModerationAction {
  id: string
  reportId: string
  action: ModerationActionType
  moderatorId: string
  reason: string
  createdAt: string
}

// In-memory store (replace with API calls when backend is ready)
const reports: Map<string, ContentReport> = new Map()
const actions: Map<string, ModerationAction[]> = new Map()

/**
 * Submit a new content report.
 */
export function submitReport(
  report: Omit<ContentReport, 'id' | 'createdAt' | 'status'>
): ContentReport {
  const newReport: ContentReport = {
    ...report,
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  reports.set(newReport.id, newReport)
  return newReport
}

/**
 * Get all reports filed against a specific piece of content.
 */
export function getReportsForContent(contentId: string): ContentReport[] {
  return Array.from(reports.values()).filter((r) => r.contentId === contentId)
}

/**
 * Get all reports (for admin/moderation queue).
 */
export function getAllReports(): ContentReport[] {
  return Array.from(reports.values())
}

/**
 * Resolve a report by taking a moderation action.
 * Updates the report status and records the action taken.
 */
export function resolveReport(
  reportId: string,
  action: Omit<ModerationAction, 'id' | 'reportId' | 'createdAt'>
): { report: ContentReport; action: ModerationAction } | null {
  const report = reports.get(reportId)
  if (!report) return null

  const newAction: ModerationAction = {
    ...action,
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reportId,
    createdAt: new Date().toISOString(),
  }

  const newStatus: ReportStatus =
    action.action === 'warn' || action.action === 'remove_content' ||
    action.action === 'temp_ban' || action.action === 'permanent_ban'
      ? 'actioned'
      : 'reviewed'

  const updatedReport: ContentReport = { ...report, status: newStatus }
  reports.set(reportId, updatedReport)

  const existing = actions.get(reportId) ?? []
  actions.set(reportId, [...existing, newAction])

  return { report: updatedReport, action: newAction }
}

/**
 * Dismiss a report without taking action.
 */
export function dismissReport(reportId: string): ContentReport | null {
  const report = reports.get(reportId)
  if (!report) return null
  const updated: ContentReport = { ...report, status: 'dismissed' }
  reports.set(reportId, updated)
  return updated
}

/**
 * Get all moderation actions for a report.
 */
export function getActionsForReport(reportId: string): ModerationAction[] {
  return actions.get(reportId) ?? []
}

/**
 * Get reports filtered by status.
 */
export function getReportsByStatus(status: ReportStatus): ContentReport[] {
  return Array.from(reports.values()).filter((r) => r.status === status)
}

/**
 * Clear all stored reports and actions (test utility).
 */
export function clearModerationStore(): void {
  reports.clear()
  actions.clear()
}
