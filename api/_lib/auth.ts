/**
 * Auth helper — verifies a Supabase session JWT.
 *
 * Uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from the environment.
 * Returns the authenticated user id or null. Never throws — callers
 * should translate null into a 401 response.
 */
import { readHeader, type RequestLike } from './http'

export interface AuthedUser {
  id: string
  email?: string
}

export async function requireUser(req: RequestLike): Promise<AuthedUser | null> {
  const authHeader = readHeader(req, 'authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { id?: string; email?: string } | null
    if (!body?.id) return null
    return { id: body.id, email: body.email }
  } catch {
    return null
  }
}
