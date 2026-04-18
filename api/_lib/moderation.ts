/**
 * Lightweight server-side content moderation.
 *
 * Intentionally scoped: screens captions and hashtags for the most common
 * abuse vectors (profanity, targeted slurs, crude NSFW terms) before content
 * reaches the database. The production pipeline also runs async perceptual
 * checks (copyright / NSFW image models) out-of-band against the uploaded
 * asset; this module is the synchronous first line of defense.
 */

export type ModerationSeverity = 'clean' | 'warn' | 'block'

export interface ModerationFinding {
  category: 'profanity' | 'slur' | 'nsfw' | 'spam' | 'harassment'
  matchedTerm: string
  severity: ModerationSeverity
}

export interface ModerationResult {
  ok: boolean
  severity: ModerationSeverity
  findings: ModerationFinding[]
}

// Intentionally terse lists — production uses an upstream service. Tokens
// only; substring matches keep false positives low for short captions.
const BLOCK_TERMS: Array<{ term: string; category: ModerationFinding['category'] }> = [
  { term: 'childporn', category: 'nsfw' },
  { term: 'cp4sale', category: 'nsfw' },
]

const WARN_TERMS: Array<{ term: string; category: ModerationFinding['category'] }> = [
  { term: 'fuck', category: 'profanity' },
  { term: 'shit', category: 'profanity' },
  { term: 'bitch', category: 'profanity' },
  { term: 'onlyfans', category: 'spam' },
  { term: 'buyfollowers', category: 'spam' },
  { term: 'freemoney', category: 'spam' },
  { term: 'killyourself', category: 'harassment' },
]

/**
 * Check caption/hashtag text for policy violations.
 *
 * Returns `{ ok: false }` only for `block`-severity findings; `warn` findings
 * are surfaced but do not block publish (UI renders a soft advisory).
 */
export function checkContent(input: {
  caption?: string
  hashtags?: string[]
}): ModerationResult {
  const haystacks: string[] = []
  if (input.caption) haystacks.push(input.caption.toLowerCase())
  if (input.hashtags) {
    for (const tag of input.hashtags) haystacks.push(tag.toLowerCase())
  }

  const findings: ModerationFinding[] = []
  let severity: ModerationSeverity = 'clean'

  for (const h of haystacks) {
    for (const { term, category } of BLOCK_TERMS) {
      if (h.includes(term)) {
        findings.push({ category, matchedTerm: term, severity: 'block' })
        severity = 'block'
      }
    }
    for (const { term, category } of WARN_TERMS) {
      if (h.includes(term)) {
        findings.push({ category, matchedTerm: term, severity: 'warn' })
        if (severity === 'clean') severity = 'warn'
      }
    }
  }

  return {
    ok: severity !== 'block',
    severity,
    findings,
  }
}
