/**
 * CSRF Protection
 *
 * Generates and validates per-session CSRF tokens for all state-changing
 * operations.  Tokens are stored in sessionStorage (not localStorage) so they
 * are never shared across browser tabs and are automatically discarded when
 * the tab is closed.
 *
 * Strategy: Double-Submit Cookie / Header pattern
 *  1. generateCsrfToken() produces a cryptographically random token and stores
 *     it in sessionStorage.
 *  2. The token is submitted with every mutating request (POST/PUT/PATCH/DELETE)
 *     as the `X-CSRF-Token` header or a hidden form field.
 *  3. validateCsrfToken() compares the submitted value against the stored one
 *     using a timing-safe comparison.
 *  4. Tokens are rotated after each successful mutation (single-use semantics).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'csrf_token';
const TOKEN_BYTE_LENGTH = 32; // 256 bits
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoredCsrfToken {
  value: string;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Storage helpers — fail silently if sessionStorage is unavailable
// ---------------------------------------------------------------------------

function readStored(): StoredCsrfToken | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCsrfToken;
  } catch {
    return null;
  }
}

function writeStored(token: StoredCsrfToken): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  } catch {
    /* quota exceeded — degrade gracefully */
  }
}

function clearStored(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Produce a hex-encoded, cryptographically random CSRF token using
 * `crypto.getRandomValues` where available, falling back to `Math.random`
 * only in environments that lack the Web Crypto API (e.g. legacy test runners).
 */
function generateRawToken(): string {
  if (
    typeof window !== 'undefined' &&
    window.crypto?.getRandomValues
  ) {
    const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js (server-side rendering / SSR route handlers)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Last resort: Math.random (NOT cryptographically secure — only for tests)
  console.warn('[csrf] Falling back to Math.random — do not use in production');
  let s = '';
  for (let i = 0; i < TOKEN_BYTE_LENGTH * 2; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the current CSRF token, generating and persisting a new one if
 * the stored token is absent or expired.
 */
export function getCsrfToken(): string {
  const stored = readStored();
  if (stored && stored.expiresAt > Date.now()) {
    return stored.value;
  }
  return rotateCsrfToken();
}

/**
 * Generate a fresh token, store it, and return it.
 * Call this after a successful mutation to enforce single-use semantics.
 */
export function rotateCsrfToken(): string {
  const value = generateRawToken();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  writeStored({ value, expiresAt });
  return value;
}

/**
 * Validate a submitted CSRF token against the stored one.
 *
 * Uses a character-by-character comparison that runs in constant time with
 * respect to the token length to prevent timing-based attacks.
 *
 * @param submitted  - The token value received from the client (header or form field).
 * @returns `true` when the token is valid and not expired; `false` otherwise.
 */
export function validateCsrfToken(submitted: string): boolean {
  if (typeof submitted !== 'string' || submitted.length === 0) return false;

  const stored = readStored();
  if (!stored) return false;
  if (stored.expiresAt <= Date.now()) {
    clearStored();
    return false;
  }

  const expected = stored.value;

  // Timing-safe comparison: always iterate over the full expected length.
  if (submitted.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    // XOR: 0 when chars match, non-zero otherwise; OR accumulates any mismatch.
    mismatch |= expected.charCodeAt(i) ^ submitted.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validate and — on success — immediately rotate the token so it cannot be
 * replayed.  This is the preferred API for mutation handlers.
 */
export function consumeCsrfToken(submitted: string): boolean {
  const valid = validateCsrfToken(submitted);
  if (valid) {
    rotateCsrfToken();
  }
  return valid;
}

/**
 * Explicitly invalidate the current CSRF token (e.g. on sign-out).
 */
export function clearCsrfToken(): void {
  clearStored();
}

/**
 * Build the `X-CSRF-Token` header object ready to spread into a fetch call.
 *
 * Example:
 *   fetch('/api/resource', { method: 'POST', headers: { ...csrfHeader(), ... } })
 */
export function csrfHeader(): { 'X-CSRF-Token': string } {
  return { 'X-CSRF-Token': getCsrfToken() };
}
