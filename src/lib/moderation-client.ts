/**
 * Thin client wrapper around the server-side moderation endpoint.
 *
 * Call `moderateServer(content, kind)` before submitting user-generated
 * content. The return shape matches the server's `ModerationResult` so it can
 * be used interchangeably with `screenContent` for rendering warnings.
 *
 * This module is the recommended enforcement integration point for
 * components. The existing `src/lib/content-moderation.ts#screenContent`
 * remains available for instant-feedback UX but MUST NOT be treated as
 * authoritative — see that file's header comment.
 *
 * Auth: attaches the current Supabase session JWT automatically. Callers that
 * run before the user is signed in should still get a 401 from the endpoint
 * and surface a useful error.
 */

import { supabase } from './supabase'

export type ContentKind =
  | 'pulse'
  | 'comment'
  | 'profile_bio'
  | 'venue_description'

export type ModerationSeverity = 'low' | 'med' | 'high'

export type ModerationResult = {
  allowed: boolean
  reasons: string[]
  severity: ModerationSeverity
  sanitized?: string
}

export type ModerateServerError = {
  allowed: false
  reasons: string[]
  severity: ModerationSeverity
  /** Non-null when the failure was a transport/auth error rather than content. */
  transportError?: string
  /** HTTP status of the backend response (0 when the fetch threw). */
  status: number
}

export type ModerateServerResult = ModerationResult | ModerateServerError

const MODERATION_ENDPOINT = '/api/moderation/check'

const fallbackError = (
  message: string,
  status: number,
): ModerateServerError => ({
  allowed: false,
  reasons: [message],
  severity: 'high',
  transportError: message,
  status,
})

const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * Call the server moderation endpoint and return its verdict.
 *
 * Never throws — failures are modelled as `ModerateServerError` so callers can
 * render a consistent UI without try/catch.
 */
export const moderateServer = async (
  content: string,
  kind: ContentKind,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ModerateServerResult> => {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return fallbackError('fetch is not available in this runtime', 0)
  }

  const token = await getAccessToken()

  let res: Response
  try {
    res = await fetchImpl(MODERATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content, kind }),
      signal: opts.signal,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error'
    return fallbackError(message, 0)
  }

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    return fallbackError(
      `Moderation endpoint returned non-JSON (status ${res.status})`,
      res.status,
    )
  }

  if (!res.ok) {
    const err = (payload as { error?: { message?: string } })?.error
    return {
      allowed: false,
      reasons: [err?.message ?? `Moderation failed (status ${res.status})`],
      severity: 'high',
      transportError: err?.message ?? `status ${res.status}`,
      status: res.status,
    }
  }

  const data = (payload as { data?: ModerationResult })?.data
  if (!data || typeof data.allowed !== 'boolean') {
    return fallbackError('Malformed response from moderation endpoint', res.status)
  }

  return {
    allowed: data.allowed,
    reasons: Array.isArray(data.reasons) ? data.reasons : [],
    severity: data.severity ?? 'low',
    sanitized: typeof data.sanitized === 'string' ? data.sanitized : undefined,
  }
}

/**
 * Type guard — narrow a result to the transport-error shape.
 */
export const isTransportError = (
  r: ModerateServerResult,
): r is ModerateServerError => {
  return (r as ModerateServerError).transportError !== undefined
}
