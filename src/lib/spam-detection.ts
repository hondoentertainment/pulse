/**
 * Spam Detection Library
 *
 * Heuristic-based spam and suspicious-pattern detection for pulse captions
 * and user behaviour. Runs entirely in the browser; no network calls required.
 */

export interface SpamDetectionResult {
  isSpam: boolean
  confidence: number      // 0–1
  reasons: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count the longest run of the same character in a string. */
function longestRepeatedCharRun(text: string): number {
  let maxRun = 1
  let currentRun = 1
  for (let i = 1; i < text.length; i++) {
    if (text[i] === text[i - 1]) {
      currentRun++
      if (currentRun > maxRun) maxRun = currentRun
    } else {
      currentRun = 1
    }
  }
  return text.length === 0 ? 0 : maxRun
}

/** Rough URL detector (http/https/bare domain). */
const URL_PATTERN = /https?:\/\/\S+|www\.\S+\.\w{2,}/gi

/** Proportion of uppercase letters (ignores non-alpha chars). */
function uppercaseProportion(text: string): number {
  const alpha = text.replace(/[^a-zA-Z]/g, '')
  if (alpha.length === 0) return 0
  const upper = alpha.replace(/[^A-Z]/g, '').length
  return upper / alpha.length
}

// ---------------------------------------------------------------------------
// Content spam detection
// ---------------------------------------------------------------------------

/**
 * Analyse a string for spam indicators.
 *
 * @param content - The text to analyse (e.g. a pulse caption).
 * @returns SpamDetectionResult with isSpam flag, 0–1 confidence, and reasons.
 */
export function detectSpam(content: string): SpamDetectionResult {
  const reasons: string[] = []
  let score = 0

  const trimmed = content.trim()

  // 1. Very short content (< 3 meaningful characters) — treat empty as low-risk
  if (trimmed.length > 0 && trimmed.length < 3) {
    reasons.push('Content is too short (under 3 characters)')
    score += 0.4
  }

  // 2. Repeated characters (e.g. "aaaaaaa", "!!!!!!")
  const maxRun = longestRepeatedCharRun(trimmed)
  if (maxRun >= 6) {
    reasons.push(`Excessive character repetition (run of ${maxRun})`)
    score += Math.min(0.5, 0.15 + (maxRun - 6) * 0.05)
  }

  // 3. All-caps (> 80 % uppercase in text longer than 5 chars)
  if (trimmed.length > 5 && uppercaseProportion(trimmed) > 0.8) {
    reasons.push('Excessive use of capital letters')
    score += 0.35
  }

  // 4. URLs in content
  const urlMatches = trimmed.match(URL_PATTERN)
  if (urlMatches && urlMatches.length > 0) {
    reasons.push(`Contains ${urlMatches.length} URL(s)`)
    score += 0.3 + (urlMatches.length - 1) * 0.1
  }

  // 5. Common spam phrases
  const SPAM_PHRASES = [
    /\b(buy now|click here|free money|limited offer|act now|order today)\b/i,
    /\b(make money fast|earn \$|casino|crypto pump|nft drop)\b/i,
  ]
  for (const pattern of SPAM_PHRASES) {
    if (pattern.test(trimmed)) {
      reasons.push('Contains known spam phrase')
      score += 0.5
      break
    }
  }

  const confidence = Math.min(1, score)
  return {
    isSpam: confidence >= 0.5,
    confidence,
    reasons,
  }
}

// ---------------------------------------------------------------------------
// Duplicate-content window
// ---------------------------------------------------------------------------

interface TimestampedContent {
  content: string
  timestamp: number
}

const recentContentStore: Map<string, TimestampedContent[]> = new Map()

/**
 * Check whether `userId` has submitted identical content within `windowMs`.
 * Registers the content so subsequent calls can detect duplicates.
 *
 * @param userId    - User performing the action.
 * @param content   - The content string being submitted.
 * @param windowMs  - Look-back window in milliseconds (default 5 minutes).
 * @returns true if the same content was already submitted within the window.
 */
export function isDuplicateContent(
  userId: string,
  content: string,
  windowMs: number = 5 * 60 * 1000,
): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  const key = userId

  const history = (recentContentStore.get(key) ?? []).filter(
    (entry) => entry.timestamp > cutoff,
  )

  const normalised = content.trim().toLowerCase()
  const isDuplicate = history.some(
    (entry) => entry.content.trim().toLowerCase() === normalised,
  )

  // Always register the new submission (whether duplicate or not)
  history.push({ content, timestamp: now })
  recentContentStore.set(key, history)

  return isDuplicate
}

/** Clear duplicate-content history (test utility / logout). */
export function clearDuplicateContentStore(): void {
  recentContentStore.clear()
}

// ---------------------------------------------------------------------------
// Behavioural pattern detection
// ---------------------------------------------------------------------------

/**
 * Flag a user whose recent actions show suspiciously identical behaviour.
 * Specifically: more than 3 actions of the same type within 60 seconds.
 *
 * @param userId         - The user being assessed (unused in this heuristic but
 *                         available for future per-user tuning).
 * @param recentActions  - Actions recorded for this user.
 * @returns true if a suspicious pattern is detected.
 */
export function detectSuspiciousPattern(
  userId: string,
  recentActions: { type: string; timestamp: number }[],
): boolean {
  if (recentActions.length === 0) return false

  const windowMs = 60 * 1000 // 1 minute
  const now = Date.now()
  const cutoff = now - windowMs

  // Group actions by type within the 1-minute window
  const countByType: Record<string, number> = {}
  for (const action of recentActions) {
    if (action.timestamp >= cutoff) {
      countByType[action.type] = (countByType[action.type] ?? 0) + 1
    }
  }

  // Flag if any action type exceeds the threshold
  const THRESHOLD = 3
  return Object.values(countByType).some((count) => count > THRESHOLD)
}
