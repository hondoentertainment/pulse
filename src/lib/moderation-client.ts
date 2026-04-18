/**
 * Moderation client.
 *
 * Thin wrapper around the `/api/moderation/check` endpoint. Components use
 * this for the authoritative moderation decision before persisting user
 * content. The client-side `screenContent()` in `content-moderation.ts`
 * remains the instant UX hint; this module is the hard gate.
 */

import { screenContent } from './content-moderation'
import { logger } from './observability/logger'

export type ModerationKind = 'pulse' | 'comment' | 'profile' | 'report'

export interface ModerationResult {
  allowed: boolean
  reasons: string[]
  severity: 'none' | 'low' | 'medium' | 'high'
  sanitized?: string
}

const log = logger.child({ component: 'moderation-client' })

/**
 * Ask the server whether content is allowed. Falls back to the local
 * `screenContent()` heuristic when the endpoint is unreachable so the
 * client still enforces a baseline gate.
 */
export async function moderateServer(
  content: string,
  kind: ModerationKind,
): Promise<ModerationResult> {
  if (!content || content.trim().length === 0) {
    return { allowed: true, reasons: [], severity: 'none' }
  }

  try {
    const res = await fetch('/api/moderation/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, kind }),
    })

    if (!res.ok) {
      log.warn('moderation endpoint returned non-2xx', { status: res.status })
      return localFallback(content)
    }

    const data = (await res.json()) as Partial<ModerationResult>
    return {
      allowed: data.allowed ?? true,
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
      severity: data.severity ?? 'none',
      sanitized: data.sanitized,
    }
  } catch (err) {
    log.warn('moderation request failed', { err: String(err) })
    return localFallback(content)
  }
}

function localFallback(content: string): ModerationResult {
  const issues = screenContent(content)
  return {
    allowed: issues.length === 0,
    reasons: issues,
    severity: issues.length === 0 ? 'none' : 'low',
  }
}
