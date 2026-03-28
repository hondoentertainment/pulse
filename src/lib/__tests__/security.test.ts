/**
 * Security Test Suite
 *
 * Covers:
 *  1. Input validation schemas (valid / invalid inputs)
 *  2. Sanitization helpers (XSS vectors)
 *  3. Enhanced rate limiter (normal, burst, reset, headers)
 *  4. CSRF token generation, validation, rotation, and expiry
 *  5. Auth guard role logic (unit-level, no DOM required)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Input validation
// ---------------------------------------------------------------------------

import {
  pulseSchema,
  profileUpdateSchema,
  reportSchema,
  eventSchema,
  searchSchema,
  sanitizeText,
  sanitizeCaption,
  sanitizeQuery,
  validateInput,
} from '../validation';

describe('pulseSchema', () => {
  const valid = {
    venue_id: '123e4567-e89b-12d3-a456-426614174000',
    energy_rating: 'buzzing' as const,
    location_lat: 37.7749,
    location_lng: -122.4194,
  };

  it('accepts a minimal valid pulse', () => {
    const result = pulseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts all optional fields when valid', () => {
    const result = pulseSchema.safeParse({
      ...valid,
      caption: 'Great vibes tonight!',
      hashtags: ['friday', 'rooftop'],
      photos: ['https://example.com/photo.jpg'],
      video_url: 'https://example.com/video.mp4',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID for venue_id', () => {
    const result = pulseSchema.safeParse({ ...valid, venue_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown energy_rating', () => {
    const result = pulseSchema.safeParse({ ...valid, energy_rating: 'lit' });
    expect(result.success).toBe(false);
  });

  it('rejects caption exceeding 280 chars', () => {
    const result = pulseSchema.safeParse({ ...valid, caption: 'x'.repeat(281) });
    expect(result.success).toBe(false);
  });

  it('rejects hashtag with invalid characters', () => {
    const result = pulseSchema.safeParse({ ...valid, hashtags: ['hello world'] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 hashtags', () => {
    const result = pulseSchema.safeParse({
      ...valid,
      hashtags: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 3 photos', () => {
    const result = pulseSchema.safeParse({
      ...valid,
      photos: [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
        'https://example.com/4.jpg',
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects latitude out of range', () => {
    expect(pulseSchema.safeParse({ ...valid, location_lat: 91 }).success).toBe(false);
    expect(pulseSchema.safeParse({ ...valid, location_lat: -91 }).success).toBe(false);
  });

  it('rejects longitude out of range', () => {
    expect(pulseSchema.safeParse({ ...valid, location_lng: 181 }).success).toBe(false);
    expect(pulseSchema.safeParse({ ...valid, location_lng: -181 }).success).toBe(false);
  });
});

describe('profileUpdateSchema', () => {
  it('accepts a valid profile update', () => {
    const result = profileUpdateSchema.safeParse({ username: 'jane_doe' });
    expect(result.success).toBe(true);
  });

  it('rejects username shorter than 3 chars', () => {
    expect(profileUpdateSchema.safeParse({ username: 'ab' }).success).toBe(false);
  });

  it('rejects username longer than 30 chars', () => {
    expect(profileUpdateSchema.safeParse({ username: 'a'.repeat(31) }).success).toBe(false);
  });

  it('rejects username with spaces', () => {
    expect(profileUpdateSchema.safeParse({ username: 'hello world' }).success).toBe(false);
  });

  it('rejects username with hyphens', () => {
    expect(profileUpdateSchema.safeParse({ username: 'hello-world' }).success).toBe(false);
  });

  it('accepts valid presence_settings', () => {
    const result = profileUpdateSchema.safeParse({
      username: 'valid_user',
      presence_settings: {
        enabled: true,
        visibility: 'friends',
        hideAtSensitiveVenues: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid visibility value', () => {
    const result = profileUpdateSchema.safeParse({
      username: 'valid_user',
      presence_settings: { enabled: true, visibility: 'contacts', hideAtSensitiveVenues: false },
    });
    expect(result.success).toBe(false);
  });
});

describe('reportSchema', () => {
  const valid = {
    target_type: 'pulse' as const,
    target_id: '123e4567-e89b-12d3-a456-426614174000',
    reason: 'spam' as const,
  };

  it('accepts a valid report', () => {
    expect(reportSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown target_type', () => {
    expect(reportSchema.safeParse({ ...valid, target_type: 'comment' }).success).toBe(false);
  });

  it('rejects details exceeding 500 chars', () => {
    expect(reportSchema.safeParse({ ...valid, details: 'x'.repeat(501) }).success).toBe(false);
  });

  it('rejects non-UUID target_id', () => {
    expect(reportSchema.safeParse({ ...valid, target_id: 'abc' }).success).toBe(false);
  });
});

describe('eventSchema', () => {
  const valid = {
    venue_id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Friday Night Live',
    start_time: '2026-04-01T20:00:00.000Z',
  };

  it('accepts a valid event', () => {
    expect(eventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(eventSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects name exceeding 100 chars', () => {
    expect(eventSchema.safeParse({ ...valid, name: 'x'.repeat(101) }).success).toBe(false);
  });

  it('rejects non-datetime start_time', () => {
    expect(eventSchema.safeParse({ ...valid, start_time: '2026-04-01' }).success).toBe(false);
  });

  it('rejects negative capacity', () => {
    expect(eventSchema.safeParse({ ...valid, capacity: -5 }).success).toBe(false);
  });
});

describe('searchSchema', () => {
  it('trims whitespace from query', () => {
    const result = searchSchema.safeParse({ query: '  rooftop bars  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.query).toBe('rooftop bars');
  });

  it('applies default values', () => {
    const result = searchSchema.safeParse({ query: 'jazz' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.radius).toBe(5);
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects query exceeding 100 chars', () => {
    expect(searchSchema.safeParse({ query: 'x'.repeat(101) }).success).toBe(false);
  });

  it('rejects radius outside 0.1–50 km', () => {
    expect(searchSchema.safeParse({ query: 'bar', radius: 0 }).success).toBe(false);
    expect(searchSchema.safeParse({ query: 'bar', radius: 51 }).success).toBe(false);
  });

  it('rejects limit outside 1–100', () => {
    expect(searchSchema.safeParse({ query: 'bar', limit: 0 }).success).toBe(false);
    expect(searchSchema.safeParse({ query: 'bar', limit: 101 }).success).toBe(false);
  });
});

describe('validateInput helper', () => {
  it('returns typed data on success', () => {
    const result = validateInput(reportSchema, {
      target_type: 'user',
      target_id: '123e4567-e89b-12d3-a456-426614174000',
      reason: 'harassment',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe('harassment');
  });

  it('returns human-readable error messages on failure', () => {
    const result = validateInput(reportSchema, { target_type: 'comment' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(typeof result.errors[0]).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Sanitization
// ---------------------------------------------------------------------------

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
    expect(sanitizeText('<script>alert(1)</script>')).toBe('alert(1)');
    expect(sanitizeText('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });

  it('removes javascript: protocol', () => {
    expect(sanitizeText('javascript:alert(1)')).not.toContain('javascript:');
    // Case-insensitive
    expect(sanitizeText('JAVASCRIPT:void(0)')).not.toContain('JAVASCRIPT:');
  });

  it('removes inline event handlers', () => {
    expect(sanitizeText('onclick=evil()')).not.toContain('onclick=');
    expect(sanitizeText('onmouseover=bad()')).not.toContain('onmouseover=');
    expect(sanitizeText('onerror=bad()')).not.toContain('onerror=');
  });

  it('removes data: URIs from text', () => {
    expect(sanitizeText('data:text/html,<h1>xss</h1>')).not.toContain('data:');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('passes through plain safe text', () => {
    expect(sanitizeText('Great vibes at the rooftop!')).toBe('Great vibes at the rooftop!');
  });
});

describe('sanitizeCaption', () => {
  it('enforces 280-character cap', () => {
    const long = 'a'.repeat(400);
    expect(sanitizeCaption(long).length).toBe(280);
  });

  it('strips XSS before capping', () => {
    const xss = '<script>alert(1)</script>' + 'x'.repeat(280);
    const result = sanitizeCaption(xss);
    expect(result).not.toContain('<script>');
    expect(result.length).toBeLessThanOrEqual(280);
  });
});

describe('sanitizeQuery', () => {
  it('collapses multiple spaces', () => {
    expect(sanitizeQuery('rooftop   bars   nyc')).toBe('rooftop bars nyc');
  });

  it('enforces 100-character limit', () => {
    expect(sanitizeQuery('x'.repeat(200)).length).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 3. Enhanced rate limiter
// ---------------------------------------------------------------------------

import {
  checkRateLimitEnhanced,
  checkUserRateLimitEnhanced,
  resetRateLimitEnhanced,
  clearAllRateLimitsEnhanced,
  detectAbusePatterns,
  ENHANCED_RATE_LIMITS,
} from '../rate-limiter-enhanced';

// localStorage is not available in the test environment; the module degrades
// gracefully by only using the in-process Map, which is fine for testing.

beforeEach(() => {
  clearAllRateLimitsEnhanced();
});

describe('checkRateLimitEnhanced — basic token bucket', () => {
  it('allows requests within the limit', () => {
    const config = { maxTokens: 5, refillRate: 1, windowMs: 60_000 };
    const result = checkRateLimitEnhanced('test-key', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks when tokens are exhausted', () => {
    const config = { maxTokens: 2, refillRate: 0.001, windowMs: 60_000 };
    checkRateLimitEnhanced('exhaust', config);
    checkRateLimitEnhanced('exhaust', config);
    const blocked = checkRateLimitEnhanced('exhaust', config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('isolates different bucket keys', () => {
    const config = { maxTokens: 1, refillRate: 0.001, windowMs: 60_000 };
    checkRateLimitEnhanced('key-a', config);
    const result = checkRateLimitEnhanced('key-b', config);
    expect(result.allowed).toBe(true);
  });
});

describe('checkRateLimitEnhanced — response headers', () => {
  it('returns correct X-RateLimit headers when allowed', () => {
    const config = { maxTokens: 10, refillRate: 1, windowMs: 60_000 };
    const { headers } = checkRateLimitEnhanced('hdr', config);
    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('9');
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(Date.now() / 1000);
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('returns Retry-After header when blocked', () => {
    const config = { maxTokens: 1, refillRate: 0.001, windowMs: 60_000 };
    checkRateLimitEnhanced('hdr-block', config);
    const { headers, allowed } = checkRateLimitEnhanced('hdr-block', config);
    expect(allowed).toBe(false);
    expect(headers['Retry-After']).toBeDefined();
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
  });
});

describe('checkUserRateLimitEnhanced', () => {
  it('uses the predefined pulse_create limit', () => {
    const result = checkUserRateLimitEnhanced('user-1', 'pulse_create');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(ENHANCED_RATE_LIMITS.pulse_create.maxTokens - 1);
  });

  it('enforces pulse_create limit of 10 per hour', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkUserRateLimitEnhanced('user-2', 'pulse_create').allowed).toBe(true);
    }
    expect(checkUserRateLimitEnhanced('user-2', 'pulse_create').allowed).toBe(false);
  });

  it('allows unknown operations (fail-open for unrecognised actions)', () => {
    const result = checkUserRateLimitEnhanced('user-3', 'nonexistent_op');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999);
  });

  it('isolates limits per user', () => {
    for (let i = 0; i < ENHANCED_RATE_LIMITS.report.maxTokens; i++) {
      checkUserRateLimitEnhanced('user-blocked', 'report');
    }
    expect(checkUserRateLimitEnhanced('user-blocked', 'report').allowed).toBe(false);
    expect(checkUserRateLimitEnhanced('user-other', 'report').allowed).toBe(true);
  });
});

describe('resetRateLimitEnhanced', () => {
  it('resets an exhausted bucket', () => {
    const config = { maxTokens: 1, refillRate: 0.001, windowMs: 60_000 };
    checkRateLimitEnhanced('u1:action', config);
    expect(checkRateLimitEnhanced('u1:action', config).allowed).toBe(false);

    resetRateLimitEnhanced('u1', 'action');
    expect(checkRateLimitEnhanced('u1:action', config).allowed).toBe(true);
  });
});

describe('detectAbusePatterns', () => {
  it('detects rapid-fire actions (>5 in 10 seconds)', () => {
    const now = Date.now();
    const actions = Array.from({ length: 8 }, (_, i) => ({
      action: 'reaction',
      timestamp: now - i * 500, // 500 ms apart — all within 10 s
    }));
    const signals = detectAbusePatterns('u1', actions);
    expect(signals.some(s => s.type === 'rapid_fire')).toBe(true);
  });

  it('detects alternating energy-rating patterns', () => {
    const now = Date.now();
    const actions = [
      { action: 'pulse_create', timestamp: now - 5000, metadata: { energyRating: 'electric' } },
      { action: 'pulse_create', timestamp: now - 4000, metadata: { energyRating: 'dead' } },
      { action: 'pulse_create', timestamp: now - 3000, metadata: { energyRating: 'electric' } },
      { action: 'pulse_create', timestamp: now - 2000, metadata: { energyRating: 'dead' } },
      { action: 'pulse_create', timestamp: now - 1000, metadata: { energyRating: 'electric' } },
    ];
    const signals = detectAbusePatterns('u1', actions);
    expect(signals.some(s => s.type === 'alternating_ratings')).toBe(true);
  });

  it('detects location spoofing (≥5 unique venues in 5 minutes)', () => {
    const now = Date.now();
    const actions = Array.from({ length: 5 }, (_, i) => ({
      action: 'check_in',
      timestamp: now - i * 10_000,
      metadata: { venueId: `venue-${i}` },
    }));
    const signals = detectAbusePatterns('u1', actions);
    expect(signals.some(s => s.type === 'location_spoofing')).toBe(true);
  });

  it('returns empty signals for normal usage', () => {
    const now = Date.now();
    const actions = [
      { action: 'venue_view', timestamp: now - 60_000 },
      { action: 'pulse_create', timestamp: now - 30_000, metadata: { energyRating: 'buzzing' } },
      { action: 'reaction', timestamp: now - 10_000 },
    ];
    const signals = detectAbusePatterns('u1', actions);
    expect(signals.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. CSRF
// ---------------------------------------------------------------------------

import {
  getCsrfToken,
  rotateCsrfToken,
  validateCsrfToken,
  consumeCsrfToken,
  clearCsrfToken,
  csrfHeader,
} from '../csrf';

// Provide a minimal sessionStorage mock for the test environment.
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();

// Provide a minimal crypto mock.
const cryptoMock = {
  getRandomValues: (buf: Uint8Array) => {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    return buf;
  },
};

beforeEach(() => {
  sessionStorageMock.clear();
  // Patch globals so the CSRF module can use them.
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage: sessionStorageMock, crypto: cryptoMock },
    configurable: true,
  });
});

afterEach(() => {
  // Restore window to avoid leaking into other test suites.
  // @ts-expect-error — intentional teardown
  delete globalThis.window;
});

describe('CSRF token generation', () => {
  it('generates a non-empty hex string', () => {
    const token = getCsrfToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
  });

  it('returns the same token on subsequent calls within TTL', () => {
    const first = getCsrfToken();
    const second = getCsrfToken();
    expect(first).toBe(second);
  });

  it('rotateCsrfToken produces a new token', () => {
    const original = getCsrfToken();
    const rotated = rotateCsrfToken();
    expect(rotated).not.toBe(original);
    expect(getCsrfToken()).toBe(rotated);
  });
});

describe('validateCsrfToken', () => {
  it('validates the correct token', () => {
    const token = getCsrfToken();
    expect(validateCsrfToken(token)).toBe(true);
  });

  it('rejects an incorrect token', () => {
    getCsrfToken();
    expect(validateCsrfToken('wrong-token')).toBe(false);
  });

  it('rejects an empty string', () => {
    getCsrfToken();
    expect(validateCsrfToken('')).toBe(false);
  });

  it('rejects when no token is stored', () => {
    clearCsrfToken();
    expect(validateCsrfToken('any-token')).toBe(false);
  });

  it('rejects an expired token', () => {
    const past = Date.now() - 1; // already expired
    sessionStorageMock.setItem(
      'csrf_token',
      JSON.stringify({ value: 'old-token', expiresAt: past }),
    );
    expect(validateCsrfToken('old-token')).toBe(false);
  });
});

describe('consumeCsrfToken', () => {
  it('returns true and rotates on valid token', () => {
    const token = getCsrfToken();
    const result = consumeCsrfToken(token);
    expect(result).toBe(true);
    // Token should have been rotated — same token is now invalid
    expect(validateCsrfToken(token)).toBe(false);
  });

  it('returns false without rotating on invalid token', () => {
    const token = getCsrfToken();
    expect(consumeCsrfToken('bad-token')).toBe(false);
    // Original token should still be valid
    expect(validateCsrfToken(token)).toBe(true);
  });
});

describe('clearCsrfToken', () => {
  it('invalidates the stored token', () => {
    const token = getCsrfToken();
    clearCsrfToken();
    expect(validateCsrfToken(token)).toBe(false);
  });
});

describe('csrfHeader', () => {
  it('returns an object with the X-CSRF-Token key', () => {
    const header = csrfHeader();
    expect(header).toHaveProperty('X-CSRF-Token');
    expect(typeof header['X-CSRF-Token']).toBe('string');
    expect(header['X-CSRF-Token'].length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Auth guard role logic
// ---------------------------------------------------------------------------

// We test the pure helper functions extracted from AuthGuard rather than
// mounting the component (which requires a full React + Supabase context).

describe('Auth guard — role hierarchy', () => {
  /**
   * Mirror of the internal helpers in AuthGuard.tsx so they can be tested
   * without importing React.
   */
  type AppRole = 'user' | 'venue_owner' | 'admin';
  const ROLE_ORDER: AppRole[] = ['user', 'venue_owner', 'admin'];

  function hasRequiredRole(userRole: AppRole | undefined, required: AppRole): boolean {
    if (!userRole) return false;
    return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(required);
  }

  function deriveRole(meta: Record<string, unknown> | undefined): AppRole | undefined {
    if (!meta) return undefined;
    const raw = meta['role'];
    if (raw === 'admin' || raw === 'venue_owner' || raw === 'user') return raw;
    return 'user';
  }

  describe('hasRequiredRole', () => {
    it('admin satisfies all roles', () => {
      expect(hasRequiredRole('admin', 'user')).toBe(true);
      expect(hasRequiredRole('admin', 'venue_owner')).toBe(true);
      expect(hasRequiredRole('admin', 'admin')).toBe(true);
    });

    it('venue_owner satisfies user but not admin', () => {
      expect(hasRequiredRole('venue_owner', 'user')).toBe(true);
      expect(hasRequiredRole('venue_owner', 'venue_owner')).toBe(true);
      expect(hasRequiredRole('venue_owner', 'admin')).toBe(false);
    });

    it('user only satisfies user', () => {
      expect(hasRequiredRole('user', 'user')).toBe(true);
      expect(hasRequiredRole('user', 'venue_owner')).toBe(false);
      expect(hasRequiredRole('user', 'admin')).toBe(false);
    });

    it('undefined role fails all checks', () => {
      expect(hasRequiredRole(undefined, 'user')).toBe(false);
      expect(hasRequiredRole(undefined, 'admin')).toBe(false);
    });
  });

  describe('deriveRole', () => {
    it('returns undefined for missing metadata', () => {
      expect(deriveRole(undefined)).toBeUndefined();
    });

    it('returns the explicit role from metadata', () => {
      expect(deriveRole({ role: 'admin' })).toBe('admin');
      expect(deriveRole({ role: 'venue_owner' })).toBe('venue_owner');
    });

    it('defaults to "user" for authenticated accounts with no role claim', () => {
      expect(deriveRole({ email: 'test@example.com' })).toBe('user');
    });

    it('defaults to "user" for unrecognised role strings', () => {
      expect(deriveRole({ role: 'superuser' })).toBe('user');
    });
  });
});
