/**
 * Collision-safe alphanumeric referral code generator.
 *
 * Uses a 32-char alphabet (A-Z minus I,O + 0-9 minus 0,1) to avoid confusable
 * glyphs (0/O, 1/I/l). 6 chars -> ~1e9 codespace, which is plenty for
 * human-typed codes if we use server-side collision checks.
 */

// 32 unambiguous characters: A-Z minus I,O + 2-9
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function secureRandomInt(max: number): number {
  // Prefer WebCrypto when available (Edge Functions, browsers), fall back to
  // Math.random only in non-security-critical dev paths.
  const globalCrypto = (globalThis as { crypto?: { getRandomValues?: (buf: Uint32Array) => Uint32Array } }).crypto
  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    globalCrypto.getRandomValues(buf)
    return buf[0] % max
  }
  return Math.floor(Math.random() * max)
}

/**
 * Generate a random code of length 6-8.
 */
export function generateCode(length: number = 6): string {
  if (length < 6 || length > 8) {
    throw new Error(`code length must be 6-8, got ${length}`)
  }
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[secureRandomInt(ALPHABET.length)]
  }
  return out
}

/**
 * Generate a code that does not collide with the provided existence checker.
 * Retries up to `maxAttempts` times, escalating length on repeated collisions
 * so we never loop forever.
 */
export async function generateUniqueCode(
  exists: (code: string) => Promise<boolean>,
  {
    startLength = 6,
    maxAttempts = 8,
  }: { startLength?: number; maxAttempts?: number } = {}
): Promise<string> {
  let length = startLength
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateCode(length)
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(code))) return code
    // after 3 collisions at a given length, widen
    if (attempt >= 3 && length < 8) length += 1
  }
  throw new Error('Could not generate a collision-free referral code')
}
