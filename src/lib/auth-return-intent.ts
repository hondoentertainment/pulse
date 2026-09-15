/**
 * Return-to-intent after magic-link / Google.
 *
 * Persist next=/venue/:id?compose=1 (or Tonight) across /auth in
 * localStorage so the guest lands back where they meant to pulse.
 * Do not change Supabase Site URL — GoTrue still receives origin only.
 */

export const AUTH_PATH = '/auth'
export const AUTH_NEXT_STORAGE_KEY = 'pulse_auth_next_v1'
export const AUTH_NEXT_QUERY = 'next'
export const COMPOSE_QUERY = 'compose'

const MAX_NEXT_LENGTH = 240

export function sanitizeAuthNext(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  let value = raw.trim()
  if (!value) return null
  try {
    value = decodeURIComponent(value)
  } catch {
    /* already decoded */
  }
  if (value.length > MAX_NEXT_LENGTH) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.includes('://')) return null
  if (value.includes('\\')) return null
  const [pathAndQuery] = value.split('#')
  if (!pathAndQuery || pathAndQuery === AUTH_PATH || pathAndQuery.startsWith(`${AUTH_PATH}?`)) {
    return null
  }
  return pathAndQuery
}

export function persistAuthNext(
  next: string | null | undefined,
  store: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage,
): string | null {
  const safe = sanitizeAuthNext(next)
  try {
    if (!store) return safe
    if (safe) store.setItem(AUTH_NEXT_STORAGE_KEY, safe)
    else store.removeItem(AUTH_NEXT_STORAGE_KEY)
  } catch {
    /* quota / private mode */
  }
  return safe
}

export function readPersistedAuthNext(
  store: Pick<Storage, 'getItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage,
): string | null {
  try {
    return sanitizeAuthNext(store?.getItem(AUTH_NEXT_STORAGE_KEY))
  } catch {
    return null
  }
}

export function clearPersistedAuthNext(
  store: Pick<Storage, 'removeItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage,
): void {
  try {
    store?.removeItem(AUTH_NEXT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function parseAuthNext(
  search: string | { get(name: string): string | null },
): string | null {
  const value = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(AUTH_NEXT_QUERY)
    : search.get(AUTH_NEXT_QUERY)
  return sanitizeAuthNext(value)
}

export function buildAuthPath(next?: string | null): string {
  const safe = sanitizeAuthNext(next)
  if (!safe) return AUTH_PATH
  persistAuthNext(safe)
  return `${AUTH_PATH}?${AUTH_NEXT_QUERY}=${encodeURIComponent(safe)}`
}

export function venueComposePath(venueId: string): string {
  const id = venueId.trim()
  if (!id) return `/?${COMPOSE_QUERY}=1`
  return `/venue/${encodeURIComponent(id)}?${COMPOSE_QUERY}=1`
}

export function parseComposeVenueId(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const compose = params.get(COMPOSE_QUERY)
  if (compose !== '1' && compose !== 'true') return null
  const match = pathname.match(/^\/venue\/([^/]+)$/)
  if (match?.[1]) return decodeURIComponent(match[1])
  return null
}

export function wantsComposeOpen(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const compose = params.get(COMPOSE_QUERY)
  return compose === '1' || compose === 'true'
}

/** After session hydrates: query next wins, then persisted next, else home. */
export function consumeAuthReturnPath(input: {
  search?: string
  store?: Pick<Storage, 'getItem' | 'removeItem'> | null
} = {}): string {
  const store = input.store ?? (typeof window === 'undefined' ? null : window.localStorage)
  const fromQuery = parseAuthNext(input.search ?? '')
  const fromStore = readPersistedAuthNext(store)
  const next = fromQuery ?? fromStore ?? '/'
  clearPersistedAuthNext(store)
  return sanitizeAuthNext(next) ?? '/'
}
