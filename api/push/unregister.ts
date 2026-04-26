/**
 * POST /api/push/unregister
 * Remove a push token for the authenticated user.
 * Body: { token: string }
 */
import { getAuthenticatedUserId } from '../_lib/auth'

type RequestLike = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

const setCors = (res: ResponseLike) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const userId = getAuthenticatedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const body = req.body as { token?: string } | undefined
  if (!body || typeof body.token !== 'string' || body.token.length === 0) {
    res.status(400).json({ error: 'Invalid payload — require { token }' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !supabaseKey) {
    console.info('[push/unregister] log-only (Supabase env missing)', { userId })
    res.status(200).json({ data: { unregistered: true, logOnly: true } })
    return
  }

  try {
    const del = await fetch(
      `${supabaseUrl}/rest/v1/push_tokens?user_id=eq.${encodeURIComponent(userId)}&token=eq.${encodeURIComponent(
        body.token,
      )}`,
      {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    )

    if (!del.ok) {
      console.error('[push/unregister] delete failed', del.status, await del.text())
      res.status(502).json({ error: 'Upstream error' })
      return
    }

    res.status(200).json({ data: { unregistered: true } })
  } catch (err) {
    console.error('[push/unregister] error', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
