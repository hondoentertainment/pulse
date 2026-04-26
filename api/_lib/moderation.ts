/**
 * Server-side content moderation — single source of truth for enforcement.
 *
 * This module is the authoritative check for user-generated content in Pulse.
 * It is imported by `api/moderation/check.ts` (exposed to clients) and by
 * `api/pulses/create.ts` (called inline before persistence) so a malicious
 * client cannot skip the gate.
 *
 * The client-side equivalent at `src/lib/content-moderation.ts` is ONLY for
 * instant UX feedback and must NEVER be trusted for enforcement.
 *
 * Tuning: edit the word lists and heuristics below and keep
 * `docs/content-safety.md` in sync.
 */

export type ContentKind = 'pulse' | 'comment' | 'profile_bio' | 'venue_description'

export type ModerationSeverity = 'low' | 'med' | 'high'

export type ModerationResult = {
  allowed: boolean
  reasons: string[]
  severity: ModerationSeverity
  sanitized?: string
}

export type ModerationInput = {
  content: string
  kind: ContentKind
}

/**
 * Per-kind limits. We enforce these server-side even if the client forgets.
 */
const MAX_LENGTHS: Record<ContentKind, number> = {
  pulse: 500,
  comment: 300,
  profile_bio: 280,
  venue_description: 1000,
}

const MIN_LENGTHS: Record<ContentKind, number> = {
  pulse: 0, // pulses can be photo-only
  comment: 1,
  profile_bio: 0,
  venue_description: 0,
}

/**
 * Banned word list. Deliberately conservative — overflagging is preferable to
 * under-flagging for launch. Entries are matched case-insensitively on word
 * boundaries. To disable an entry, comment it out rather than deleting so the
 * audit trail stays intact.
 */
const BANNED_WORDS: readonly string[] = [
  // Promo/spam
  'buy now',
  'click here',
  'free money',
  'limited offer',
  'act now',
  'cash prize',
  'viagra',
  'crypto giveaway',
  // Slurs / harassment stand-ins — real list should live in a private file,
  // this keeps the shape wired up for launch.
  'kys',
]

/**
 * URL allowlist (registrable domains). Anything outside is flagged at med
 * severity; known-bad TLDs escalate to high.
 */
const URL_ALLOWLIST: readonly string[] = [
  'pulse.app',
  'pulseapp.co',
  'supabase.co',
  'vercel.app',
  'github.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'maps.google.com',
  'google.com',
]

const HIGH_RISK_TLDS = ['ru', 'cn', 'tk', 'ml', 'ga', 'cf', 'xyz', 'top']

// Heuristics
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g
const URL_REGEX = /\bhttps?:\/\/([^\s/$.?#].[^\s]*)/gi
const SHOUT_REGEX = /[A-Z]{10,}/
const REPEAT_CHAR_REGEX = /(.)\1{6,}/

const countMatches = (text: string, re: RegExp): number => {
  const cloned = new RegExp(re.source, re.flags)
  let n = 0
  while (cloned.exec(text) !== null) {
    n++
    if (n > 50) break // safety
  }
  return n
}

const escalate = (
  current: ModerationSeverity,
  candidate: ModerationSeverity,
): ModerationSeverity => {
  const order: ModerationSeverity[] = ['low', 'med', 'high']
  return order[Math.max(order.indexOf(current), order.indexOf(candidate))]
}

const extractHostname = (url: string): string | null => {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url)
  if (!m) return null
  return m[1].toLowerCase().replace(/^www\./, '')
}

const isAllowedHost = (host: string): boolean => {
  return URL_ALLOWLIST.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  )
}

const hostTld = (host: string): string => {
  const parts = host.split('.')
  return parts[parts.length - 1] ?? ''
}

/** Remove PII-shaped substrings from the content for logging/storage. */
const sanitize = (text: string): string => {
  return text
    .replace(EMAIL_REGEX, '[redacted-email]')
    .replace(PHONE_REGEX, '[redacted-phone]')
}

/**
 * Main entry point. Pure function — no I/O, no network, no clock-dependent
 * rate limiting (that lives in `rate-limit.ts`).
 */
export const checkContent = (input: ModerationInput): ModerationResult => {
  const reasons: string[] = []
  let severity: ModerationSeverity = 'low'

  const kind = input.kind
  if (!MAX_LENGTHS[kind]) {
    return {
      allowed: false,
      reasons: [`Unknown content kind: ${kind}`],
      severity: 'high',
    }
  }

  const raw = typeof input.content === 'string' ? input.content : ''
  const text = raw.normalize('NFKC')
  const lowered = text.toLowerCase()

  // Length guards
  if (text.length < MIN_LENGTHS[kind]) {
    reasons.push(`${kind} must be at least ${MIN_LENGTHS[kind]} characters`)
    severity = escalate(severity, 'low')
  }
  if (text.length > MAX_LENGTHS[kind]) {
    reasons.push(`${kind} exceeds maximum length of ${MAX_LENGTHS[kind]}`)
    severity = escalate(severity, 'med')
  }

  // Banned words
  for (const phrase of BANNED_WORDS) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wordBoundary = /^\w/.test(phrase) && /\w$/.test(phrase)
    const re = wordBoundary
      ? new RegExp(`\\b${escaped}\\b`, 'i')
      : new RegExp(escaped, 'i')
    if (re.test(lowered)) {
      reasons.push(`Contains disallowed phrase: "${phrase}"`)
      severity = escalate(severity, 'high')
    }
  }

  // PII: emails
  const emailCount = countMatches(text, EMAIL_REGEX)
  if (emailCount > 0) {
    reasons.push('Contains email address — share contact info privately')
    severity = escalate(severity, 'med')
  }

  // PII: phone numbers (skip for venue_description where a phone is legitimate)
  if (kind !== 'venue_description') {
    const phoneCount = countMatches(text, PHONE_REGEX)
    if (phoneCount > 0) {
      reasons.push('Contains phone number — share contact info privately')
      severity = escalate(severity, 'med')
    }
  }

  // URL allowlist
  const urls: string[] = []
  const urlIter = new RegExp(URL_REGEX.source, URL_REGEX.flags)
  let urlMatch: RegExpExecArray | null
  while ((urlMatch = urlIter.exec(text)) !== null) {
    urls.push(urlMatch[0])
    if (urls.length > 20) break
  }
  for (const url of urls) {
    const host = extractHostname(url)
    if (!host) continue
    if (HIGH_RISK_TLDS.includes(hostTld(host))) {
      reasons.push(`Blocked link to high-risk TLD: ${host}`)
      severity = escalate(severity, 'high')
      continue
    }
    if (!isAllowedHost(host)) {
      reasons.push(`Link not on allowlist: ${host}`)
      severity = escalate(severity, 'med')
    }
  }

  // Spam heuristics
  if (urls.length > 3) {
    reasons.push('Too many links — looks like spam')
    severity = escalate(severity, 'med')
  }
  if (SHOUT_REGEX.test(text)) {
    reasons.push('Excessive uppercase — tone it down')
    severity = escalate(severity, 'low')
  }
  if (REPEAT_CHAR_REGEX.test(text)) {
    reasons.push('Repeated characters look spammy')
    severity = escalate(severity, 'low')
  }

  // "Allowed" rule: low-severity issues do not block; med+ issues block.
  const allowed = reasons.length === 0 || severity === 'low'

  return {
    allowed,
    reasons,
    severity,
    sanitized: sanitize(text),
  }
}
