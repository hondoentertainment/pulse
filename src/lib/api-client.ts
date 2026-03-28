/**
 * Secure API Client
 *
 * A production-grade wrapper around fetch / Supabase that provides:
 *  - Automatic auth-token attachment
 *  - Zod response validation
 *  - Transparent 401 token-refresh with one retry
 *  - Structured request/response logging (no sensitive data)
 *  - GET request deduplication
 *  - Configurable timeout (30 s default)
 *  - Sensitive data stripping from error logs
 */

import { z } from 'zod';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// Fields that must never appear in logged payloads.
const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'token',
  'secret',
  'api_key',
  'apiKey',
  'authorization',
  'access_token',
  'refresh_token',
  'credit_card',
  'cvv',
  'ssn',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiRequestOptions<TSchema extends z.ZodTypeAny = z.ZodUnknown> {
  /** Zod schema to validate the parsed JSON response body against. */
  schema?: TSchema;
  /** Extra headers to merge (auth header is added automatically). */
  headers?: Record<string, string>;
  /** Request body — will be JSON-serialised. */
  body?: unknown;
  /** Timeout in milliseconds. Defaults to 30 000. */
  timeoutMs?: number;
  /** When true, bypasses the GET deduplication cache. */
  forceRefetch?: boolean;
}

export type ApiResponse<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number };

// ---------------------------------------------------------------------------
// GET deduplication cache
// ---------------------------------------------------------------------------

interface InFlight {
  promise: Promise<Response>;
  controller: AbortController;
}

const inFlightGets = new Map<string, InFlight>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Retrieve a fresh access token from Supabase, refreshing if needed. */
async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** Deep-clone an object, replacing sensitive field values with '[REDACTED]'. */
function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => redactSensitive(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_FIELD_NAMES.has(k.toLowerCase()) ? '[REDACTED]' : redactSensitive(v, depth + 1);
  }
  return result;
}

/** Emit a structured, non-sensitive log entry. */
function log(
  level: 'info' | 'warn' | 'error',
  event: string,
  meta: Record<string, unknown>,
): void {
  const safe = redactSensitive(meta);
  // In production, swap this for your logging sink (Sentry breadcrumb, etc.).
  const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  method(`[api-client] ${event}`, safe);
}

/** Create an AbortSignal that fires after `ms` milliseconds. */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), ms);
  return controller.signal;
}

/** Combine multiple AbortSignals into one. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

async function executeFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const timeout = timeoutSignal(timeoutMs);
  const combined =
    init.signal
      ? anySignal([timeout, init.signal as AbortSignal])
      : timeout;

  return fetch(url, { ...init, signal: combined });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Perform an authenticated HTTP request.
 *
 * On a 401 response, the client will attempt a single token-refresh and retry
 * the request once before returning an error to the caller.
 */
export async function apiRequest<TSchema extends z.ZodTypeAny = z.ZodUnknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  options: ApiRequestOptions<TSchema> = {},
): Promise<ApiResponse<z.output<TSchema>>> {
  const {
    schema,
    headers: extraHeaders = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    forceRefetch = false,
  } = options;

  const startedAt = Date.now();
  const requestId = Math.random().toString(36).slice(2, 10);

  log('info', 'request.start', { requestId, method, url });

  // Build headers
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const init: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  // GET deduplication
  const dedupKey = method === 'GET' && !forceRefetch ? `GET:${url}` : null;

  async function doFetch(retrying = false): Promise<ApiResponse<z.output<TSchema>>> {
    let response: Response;
    try {
      if (dedupKey && !retrying) {
        let inflight = inFlightGets.get(dedupKey);
        if (!inflight) {
          const controller = new AbortController();
          const promise = executeFetch(url, { ...init, signal: controller.signal }, timeoutMs);
          inflight = { promise, controller };
          inFlightGets.set(dedupKey, inflight);
          promise.finally(() => inFlightGets.delete(dedupKey));
        }
        response = await inflight.promise;
      } else {
        response = await executeFetch(url, init, timeoutMs);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      log('error', 'request.network_error', { requestId, url, message });
      return { ok: false, error: message, status: 0 };
    }

    const elapsed = Date.now() - startedAt;
    log('info', 'request.complete', { requestId, status: response.status, elapsed });

    // Handle 401: refresh and retry once
    if (response.status === 401 && !retrying) {
      log('warn', 'request.token_expired', { requestId, url });
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        log('error', 'request.refresh_failed', { requestId, error: refreshError.message });
        return { ok: false, error: 'Session expired — please sign in again.', status: 401 };
      }
      // Patch the auth header with the new token
      const newToken = await getAccessToken();
      if (newToken) {
        (init.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      }
      return doFetch(true);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        errorMessage = typeof errBody?.message === 'string' ? errBody.message : errorMessage;
      } catch {
        // Non-JSON error body — use status text
        errorMessage = response.statusText || errorMessage;
      }
      log('warn', 'request.http_error', { requestId, status: response.status, errorMessage });
      return { ok: false, error: errorMessage, status: response.status };
    }

    // Parse and validate body
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return { ok: false, error: 'Invalid JSON response', status: response.status };
    }

    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        log('warn', 'request.schema_mismatch', { requestId, url, errors });
        return {
          ok: false,
          error: `Response validation failed: ${errors}`,
          status: response.status,
        };
      }
      return { ok: true, data: result.data, status: response.status };
    }

    return { ok: true, data: parsed as z.output<TSchema>, status: response.status };
  }

  return doFetch();
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

export const apiGet = <T extends z.ZodTypeAny = z.ZodUnknown>(
  url: string,
  opts?: ApiRequestOptions<T>,
) => apiRequest<T>('GET', url, opts);

export const apiPost = <T extends z.ZodTypeAny = z.ZodUnknown>(
  url: string,
  body: unknown,
  opts?: ApiRequestOptions<T>,
) => apiRequest<T>('POST', url, { ...opts, body });

export const apiPut = <T extends z.ZodTypeAny = z.ZodUnknown>(
  url: string,
  body: unknown,
  opts?: ApiRequestOptions<T>,
) => apiRequest<T>('PUT', url, { ...opts, body });

export const apiPatch = <T extends z.ZodTypeAny = z.ZodUnknown>(
  url: string,
  body: unknown,
  opts?: ApiRequestOptions<T>,
) => apiRequest<T>('PATCH', url, { ...opts, body });

export const apiDelete = <T extends z.ZodTypeAny = z.ZodUnknown>(
  url: string,
  opts?: ApiRequestOptions<T>,
) => apiRequest<T>('DELETE', url, opts);
