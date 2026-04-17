/**
 * Spotify proxy.
 *
 * Proxies two read-only operations to the Spotify Web API using the
 * server-held client credentials (client_credentials OAuth flow for
 * public catalog reads; Authorization-Code flow tokens stored per-user
 * for playlist reads):
 *
 *   GET  /api/integrations/spotify?op=search&q=...&limit=10
 *   GET  /api/integrations/spotify?op=playlists   (user-scoped, requires JWT)
 *
 * Secrets used (server-only, never sent to client):
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *
 * The user playlist path expects the browser to have stored a
 * Spotify access-token via a prior OAuth exchange that this function
 * does NOT cover — see docs/secrets-and-integrations.md.
 */

import {
  handleOptions,
  methodNotAllowed,
  setCors,
  badRequest,
  serverError,
  tooManyRequests,
  unauthorized,
  getHeader,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { clientKey, rateLimit } from '../_lib/rate-limit'
import { verifySupabaseJwt } from '../_lib/auth'
import { asEnum, asNumber, asString } from '../_lib/validate'

type SpotifyTokenResponse = { access_token: string; expires_in: number }

let cachedAppToken: { value: string; expiresAt: number } | null = null

async function getAppToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!id || !secret) throw new Error('Spotify credentials not configured')

  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 15_000) {
    return cachedAppToken.value
  }

  const basic = Buffer.from(`${id}:${secret}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed (${res.status})`)
  }
  const payload = (await res.json()) as SpotifyTokenResponse
  cachedAppToken = {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  }
  return payload.access_token
}

async function searchTracks(
  query: string,
  limit: number
): Promise<unknown> {
  const token = await getAppToken()
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'track')
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Spotify search failed (${res.status})`)
  const payload = (await res.json()) as {
    tracks?: {
      items?: Array<{
        id: string
        name: string
        artists: Array<{ name: string }>
        album?: { name?: string; images?: Array<{ url: string }> }
        external_urls?: { spotify?: string }
      }>
    }
  }

  return (payload.tracks?.items ?? []).map(t => ({
    id: t.id,
    name: t.name,
    artist: t.artists.map(a => a.name).join(', '),
    album: t.album?.name ?? null,
    artworkUrl: t.album?.images?.[0]?.url ?? null,
    spotifyUrl: t.external_urls?.spotify ?? null,
  }))
}

async function fetchUserPlaylists(userToken: string): Promise<unknown> {
  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${userToken}` },
  })
  if (!res.ok) throw new Error(`Spotify playlists failed (${res.status})`)
  const payload = (await res.json()) as {
    items?: Array<{
      id: string
      name: string
      public?: boolean
      tracks?: { total?: number }
      external_urls?: { spotify?: string }
    }>
  }
  return (payload.items ?? []).map(p => ({
    id: p.id,
    name: p.name,
    isPublic: p.public ?? false,
    trackCount: p.tracks?.total ?? 0,
    spotifyUrl: p.external_urls?.spotify ?? null,
  }))
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  setCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS'])

  const rl = rateLimit(clientKey(req, 'spotify'), 30, 60_000)
  if (!rl.allowed) return tooManyRequests(res, 'Too many Spotify requests', rl.retryAfterSeconds)

  const query = req.query ?? {}
  const op = asEnum(query.op, ['search', 'playlists'] as const)
  if (!op) return badRequest(res, 'Missing or invalid `op` (expected `search` or `playlists`)')

  try {
    if (op === 'search') {
      const q = asString(query.q, 1, 200)
      if (!q) return badRequest(res, 'Missing `q` query parameter')
      const rawLimit = query.limit
      const limit = asNumber(
        rawLimit === undefined ? 10 : Number(rawLimit),
        { min: 1, max: 50 }
      ) ?? 10
      const tracks = await searchTracks(q, limit)
      res.status(200).json({ data: tracks })
      return
    }

    // op === 'playlists' — user-scoped, requires Supabase JWT + Spotify user token
    const auth = await verifySupabaseJwt(req)
    if (!auth.ok) return unauthorized(res, auth.error ?? 'Unauthorized')

    const spotifyToken = getHeader(req, 'x-spotify-token')
    if (!spotifyToken) {
      return badRequest(
        res,
        'Missing `X-Spotify-Token` header (caller must complete Spotify OAuth first)'
      )
    }
    const playlists = await fetchUserPlaylists(spotifyToken)
    res.status(200).json({ data: playlists })
  } catch (err) {
    serverError(
      res,
      'Spotify request failed',
      err instanceof Error ? err.message : undefined
    )
  }
}
