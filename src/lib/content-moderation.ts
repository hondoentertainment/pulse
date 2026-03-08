import type { Pulse, User } from './types'

/**
 * Content Moderation Engine
 *
 * Handles flag/report flows, user blocking/muting, and basic content screening.
 */

export type ReportReason =
  | 'spam'
  | 'inappropriate'
  | 'harassment'
  | 'misinformation'
  | 'fake_location'
  | 'other'

export interface ContentReport {
  id: string
  reporterId: string
  targetType: 'pulse' | 'user'
  targetId: string
  reason: ReportReason
  description?: string
  createdAt: string
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  reviewedAt?: string
  actionTaken?: 'none' | 'warning' | 'content_removed' | 'user_suspended'
}

export interface UserBlock {
  id: string
  blockerId: string
  blockedUserId: string
  createdAt: string
}

export interface UserMute {
  id: string
  muterId: string
  mutedUserId: string
  createdAt: string
}

export interface ModerationState {
  reports: ContentReport[]
  blocks: UserBlock[]
  mutes: UserMute[]
}

export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam', label: 'Spam', description: 'Promotional or repetitive content' },
  { value: 'inappropriate', label: 'Inappropriate', description: 'Offensive or explicit content' },
  { value: 'harassment', label: 'Harassment', description: 'Bullying or targeted abuse' },
  { value: 'misinformation', label: 'Misinformation', description: 'False venue or energy info' },
  { value: 'fake_location', label: 'Fake Location', description: 'User is not actually at this venue' },
  { value: 'other', label: 'Other', description: 'Something else' },
]

// Blocklist for basic text screening
const BLOCKED_PATTERNS = [
  /\b(buy now|click here|free money|limited offer)\b/i,
  /https?:\/\/\S+\.(ru|cn|tk)\b/i,
]

/**
 * Basic content screening for pulse captions.
 * Returns issues found, empty array if clean.
 */
export function screenContent(text?: string): string[] {
  if (!text) return []
  const issues: string[] = []

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      issues.push('Potentially spammy content detected')
      break
    }
  }

  if (text.length > 500) {
    issues.push('Caption exceeds maximum length')
  }

  return issues
}

/**
 * Create a content report.
 */
export function createReport(
  reporterId: string,
  targetType: 'pulse' | 'user',
  targetId: string,
  reason: ReportReason,
  description?: string
): ContentReport {
  return {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reporterId,
    targetType,
    targetId,
    reason,
    description,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
}

/**
 * Check if a user has blocked another user.
 */
export function isBlocked(blocks: UserBlock[], userId: string, targetUserId: string): boolean {
  return blocks.some(b =>
    (b.blockerId === userId && b.blockedUserId === targetUserId) ||
    (b.blockerId === targetUserId && b.blockedUserId === userId)
  )
}

/**
 * Check if a user has muted another user.
 */
export function isMuted(mutes: UserMute[], userId: string, targetUserId: string): boolean {
  return mutes.some(m => m.muterId === userId && m.mutedUserId === targetUserId)
}

/**
 * Block a user.
 */
export function createBlock(blockerId: string, blockedUserId: string): UserBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    blockerId,
    blockedUserId,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Mute a user.
 */
export function createMute(muterId: string, mutedUserId: string): UserMute {
  return {
    id: `mute-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    muterId,
    mutedUserId,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Filter pulses removing content from blocked/muted users.
 */
export function filterModeratedPulses(
  pulses: Pulse[],
  currentUserId: string,
  blocks: UserBlock[],
  mutes: UserMute[]
): Pulse[] {
  return pulses.filter(p => {
    if (isBlocked(blocks, currentUserId, p.userId)) return false
    if (isMuted(mutes, currentUserId, p.userId)) return false
    return true
  })
}

/**
 * Get pending reports count (for admin badge).
 */
export function getPendingReportCount(reports: ContentReport[]): number {
  return reports.filter(r => r.status === 'pending').length
}

/**
 * Check if a user has too many reports (auto-flag threshold).
 */
export function isAutoFlagged(reports: ContentReport[], userId: string, threshold: number = 5): boolean {
  const userReports = reports.filter(
    r => r.targetId === userId && r.targetType === 'user' && r.status === 'pending'
  )
  return userReports.length >= threshold
}
